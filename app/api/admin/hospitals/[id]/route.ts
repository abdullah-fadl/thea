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
const updateHospitalSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/hospitals/:id
 * Get a single hospital by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, role }, resolvedParams) => {
    try {
      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Build query with access control and tenant isolation
      const where: any = { tenantId: tenant.id, id };

      if (role === 'hospital-admin' && user.hospitalId) {
        // Hospital Admin can only see their own hospital
        if (id !== user.hospitalId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else if (role === 'group-admin' && user.groupId) {
        // Group Admin can see hospitals in their group
        where.groupId = user.groupId;
      } else if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const hospital = await prisma.hospital.findFirst({ where });

      if (!hospital) {
        return NextResponse.json(
          { error: 'Hospital not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ hospital });
    } catch (error) {
      logger.error('Get hospital error', { category: 'api', route: 'GET /api/admin/hospitals/[id]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}

/**
 * PATCH /api/admin/hospitals/:id
 * Update a hospital
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin and group-admin can update hospitals
      if (!['admin', 'group-admin'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const body = await req.json();
      const v = validateBody(body, updateHospitalSchema);
      if ('error' in v) return v.error;
      const data = v.data;

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Build query with access control and tenant isolation
      const where: any = { tenantId: tenant.id, id };

      if (role === 'group-admin' && user.groupId) {
        where.groupId = user.groupId;
      }

      // Verify hospital exists and user has access
      const existingHospital = await prisma.hospital.findFirst({ where });

      if (!existingHospital) {
        return NextResponse.json(
          { error: 'Hospital not found or access denied' },
          { status: 404 }
        );
      }

      // If groupId is being updated, verify it exists and belongs to tenant
      const targetGroupId = data.groupId !== undefined ? data.groupId : existingHospital.groupId;
      if (data.groupId !== undefined && data.groupId !== existingHospital.groupId) {
        const group = await prisma.orgGroup.findFirst({
          where: { tenantId: tenant.id, id: data.groupId },
        });

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found or access denied' },
            { status: 404 }
          );
        }
      }

      // If code is being updated, check for duplicates within the target group
      if (data.code && data.code !== existingHospital.code) {
        const duplicateHospital = await prisma.hospital.findFirst({
          where: { tenantId: tenant.id, code: data.code, groupId: targetGroupId, NOT: { id } },
        });

        if (duplicateHospital) {
          return NextResponse.json(
            { error: 'Hospital with this code already exists in this group' },
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
      if (data.groupId !== undefined) {
        updateData.groupId = data.groupId;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const updatedHospital = await prisma.hospital.update({
        where: { id },
        data: updateData,
      });

      // Create audit log - with tenant isolation
      await createAuditLog('hospital', id, 'update', userId, user.email, updateData, tenantId);

      return NextResponse.json({
        success: true,
        hospital: updatedHospital,
      });
    } catch (error) {
      logger.error('Update hospital error', { category: 'api', route: 'PATCH /api/admin/hospitals/[id]', error });

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
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}

/**
 * DELETE /api/admin/hospitals/:id
 * Delete a hospital (soft delete by setting isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin and group-admin can delete hospitals
      if (!['admin', 'group-admin'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Build query with access control and tenant isolation
      const where: any = { tenantId: tenant.id, id };

      if (role === 'group-admin' && user.groupId) {
        where.groupId = user.groupId;
      }

      // Verify hospital exists and user has access
      const existingHospital = await prisma.hospital.findFirst({ where });

      if (!existingHospital) {
        return NextResponse.json(
          { error: 'Hospital not found or access denied' },
          { status: 404 }
        );
      }

      // Check if hospital has active users
      const activeUsers = await prisma.user.count({
        where: { tenantId: tenant.id, hospitalId: id, isActive: true },
      });

      if (activeUsers > 0) {
        return NextResponse.json(
          { error: 'Cannot delete hospital with active users' },
          { status: 400 }
        );
      }

      // Soft delete: set isActive=false
      await prisma.hospital.update({
        where: { id },
        data: {
          isActive: false,
          updatedBy: userId,
        },
      });

      // Create audit log - with tenant isolation
      await createAuditLog('hospital', id, 'delete', userId, user.email, { isActive: false }, tenantId);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Delete hospital error', { category: 'api', route: 'DELETE /api/admin/hospitals/[id]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}
