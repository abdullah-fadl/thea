import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const updateRoomSchema = z.object({
  floorKey: z.string().min(1).optional(),
  departmentKey: z.string().min(1).optional(),
  roomNumber: z.string().min(1).optional(),
  roomName: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get room by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Resolve tenant UUID from tenant key
      const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      // Use Prisma to find the room via raw SQL (floor_rooms table)
      const rooms: any[] = await prisma.$queryRaw`
        SELECT * FROM floor_rooms
        WHERE id = ${roomId}::uuid
          AND "tenantId" = ${tenant.id}::uuid
          AND active = true
        LIMIT 1
      `;

      const room = rooms[0] || null;

      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: room });
    } catch (error: any) {
      logger.error('Error fetching room', { category: 'api', route: 'GET /api/structure/rooms/[id]', error });
      return NextResponse.json(
        { error: 'Failed to fetch room' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.rooms.read' })(request);
}

// PUT - Update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Check permission
      if (
        !permissions.includes('admin.structure-management.edit') &&
        !permissions.includes('admin.users') &&
        user.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const body = await req.json();
      const v = validateBody(body, updateRoomSchema);
      if ('error' in v) return v.error;
      const validatedData = v.data;

      // Resolve tenant UUID from tenant key
      const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      // Check room exists
      const existingRooms: any[] = await prisma.$queryRaw`
        SELECT * FROM floor_rooms
        WHERE id = ${roomId}::uuid
          AND "tenantId" = ${tenant.id}::uuid
          AND active = true
        LIMIT 1
      `;

      if (!existingRooms[0]) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      // Update with tenant isolation
      const now = new Date();
      await prisma.$executeRaw`
        UPDATE floor_rooms
        SET
          "floorKey" = COALESCE(${validatedData.floorKey ?? null}, "floorKey"),
          "departmentKey" = COALESCE(${validatedData.departmentKey ?? null}, "departmentKey"),
          "roomNumber" = COALESCE(${validatedData.roomNumber ?? null}, "roomNumber"),
          "roomName" = COALESCE(${validatedData.roomName ?? null}, "roomName"),
          label_en = COALESCE(${validatedData.label_en ?? null}, label_en),
          label_ar = COALESCE(${validatedData.label_ar ?? null}, label_ar),
          "updatedAt" = ${now},
          "updatedBy" = ${user.id}
        WHERE id = ${roomId}::uuid
          AND "tenantId" = ${tenant.id}::uuid
          AND active = true
      `;

      // Fetch updated room
      const updatedRooms: any[] = await prisma.$queryRaw`
        SELECT * FROM floor_rooms
        WHERE id = ${roomId}::uuid
          AND "tenantId" = ${tenant.id}::uuid
        LIMIT 1
      `;

      return NextResponse.json({ success: true, data: updatedRooms[0] });
    } catch (error: any) {
      logger.error('Error updating room', { category: 'api', route: 'PUT /api/structure/rooms/[id]', error });
      return NextResponse.json(
        { error: 'Failed to update room' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.rooms.update' })(request);
}

// DELETE - Delete room (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Check permission
      if (
        !permissions.includes('admin.structure-management.delete') &&
        !permissions.includes('admin.users') &&
        user.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      // Resolve tenant UUID from tenant key
      const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      // Soft delete by setting active = false
      const result = await prisma.$executeRaw`
        UPDATE floor_rooms
        SET
          active = false,
          "updatedAt" = ${new Date()},
          "updatedBy" = ${user.id}
        WHERE id = ${roomId}::uuid
          AND "tenantId" = ${tenant.id}::uuid
          AND active = true
      `;

      if (result === 0) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting room', { category: 'api', route: 'DELETE /api/structure/rooms/[id]', error });
      return NextResponse.json(
        { error: 'Failed to delete room' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.rooms.delete' })(request);
}
