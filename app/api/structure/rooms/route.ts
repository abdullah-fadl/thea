import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  floorKey: z.string().min(1),
  departmentId: z.string().min(1),
  departmentKey: z.string().min(1),
  roomNumber: z.string().min(1),
  roomName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List rooms (filtered by floorKey and departmentKey)
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');

    let rooms;
    if (floorKey && departmentKey) {
      rooms = await structureService.getRoomsByFloorAndDepartment(floorKey, departmentKey, tenantId);
    } else {
      rooms = await structureService.getAllRooms(tenantId);
    }

    return NextResponse.json({ success: true, data: rooms });
});

// POST - Create room
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await getAuthContext(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: admin.structure-management.create
    const user = await prisma.user.findFirst({ where: { id: authResult.userId } });
    const userPermissions = user?.permissions || [];

    if (
      !userPermissions.includes('admin.structure-management.create') &&
      !userPermissions.includes('admin.users')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateBody(body, createRoomSchema);
    if ('error' in v) return v.error;
    const validatedData = v.data;

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    const room = await structureService.createRoom({
      floorId: validatedData.floorId,
      floorKey: validatedData.floorKey,
      departmentId: validatedData.departmentId,
      departmentKey: validatedData.departmentKey,
      roomNumber: validatedData.roomNumber,
      roomName: validatedData.roomName,
      label_en: validatedData.label_en,
      label_ar: validatedData.label_ar,
      createdBy: authResult.userId,
      tenantId: tenantId, // Always set tenantId on creation
    });

    return NextResponse.json({ success: true, data: room }, { status: 201 });
});
