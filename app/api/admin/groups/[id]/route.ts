import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { createAuditLog } from '@/lib/utils/audit';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/groups/:id
 * Get a single group by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, role }, resolvedParams) => {
    try {
      // Only admin can view groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      const group = await prisma.orgGroup.findFirst({
        where: { tenantId: tenant.id, id },
      });

      if (!group) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ group });
    } catch (error) {
      logger.error('Get group error', { category: 'api', route: 'GET /api/admin/groups/[id]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}

/**
 * PATCH /api/admin/groups/:id
 * Update a group
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin can update groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const body = await req.json();
      const v = validateBody(body, updateGroupSchema);
      if ('error' in v) return v.error;
      const data = v.data;

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Verify group exists and belongs to tenant
      const existingGroup = await prisma.orgGroup.findFirst({
        where: { tenantId: tenant.id, id },
      });

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // If code is being updated, check for duplicates
      if (data.code && data.code !== existingGroup.code) {
        const duplicateGroup = await prisma.orgGroup.findFirst({
          where: { tenantId: tenant.id, code: data.code, NOT: { id } },
        });

        if (duplicateGroup) {
          return NextResponse.json(
            { error: 'Group with this code already exists' },
            { status: 400 }
          );
        }
      }

      // Build update object
      const updateData: any = {
        updatedBy: userId,
      };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.code !== undefined) {
        updateData.code = data.code;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const updatedGroup = await prisma.orgGroup.update({
        where: { id },
        data: updateData,
      });

      // Create audit log - with tenant isolation
      await createAuditLog('group', id, 'update', userId, user.email, updateData, tenantId);

      return NextResponse.json({
        success: true,
        group: updatedGroup,
      });
    } catch (error) {
      logger.error('Update group error', { category: 'api', route: 'PATCH /api/admin/groups/[id]', error });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          // [SEC-10]
          { error: 'Invalid request format' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}

/**
 * DELETE /api/admin/groups/:id
 * Delete a group (soft delete by setting isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin can delete groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Verify group exists and belongs to tenant
      const existingGroup = await prisma.orgGroup.findFirst({
        where: { tenantId: tenant.id, id },
      });

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // Check if group has active hospitals
      const activeHospitals = await prisma.hospital.count({
        where: { tenantId: tenant.id, groupId: id, isActive: true },
      });

      if (activeHospitals > 0) {
        return NextResponse.json(
          { error: 'Cannot delete group with active hospitals' },
          { status: 400 }
        );
      }

      // Soft delete: set isActive=false
      await prisma.orgGroup.update({
        where: { id },
        data: {
          isActive: false,
          updatedBy: userId,
        },
      });

      // Create audit log - with tenant isolation
      await createAuditLog('group', id, 'delete', userId, user.email, { isActive: false }, tenantId);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Delete group error', { category: 'api', route: 'DELETE /api/admin/groups/[id]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}
