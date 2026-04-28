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
const createHospitalSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  groupId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

/**
 * GET /api/admin/hospitals
 * Get hospitals - filtered by groupId query param if provided
 * Access control:
 * - Admin: can view all hospitals in tenant
 * - Group Admin: can view hospitals in their group
 * - Hospital Admin: can view only their hospital
 */
export const GET = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Build query based on user role with tenant isolation
    const where: any = { tenantId: tenant.id };

    if (role === 'hospital-admin' && user.hospitalId) {
      // Hospital Admin can only see their own hospital
      where.id = user.hospitalId;
    } else if (role === 'group-admin' && user.groupId) {
      // Group Admin can see all hospitals in their group
      where.groupId = user.groupId;
      if (groupId && groupId !== user.groupId) {
        // Cannot access other groups
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (role === 'admin') {
      // Admin can see all hospitals, optionally filtered by groupId
      if (groupId) {
        where.groupId = groupId;
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hospitals = await prisma.hospital.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ hospitals });
  } catch (error) {
    logger.error('Get hospitals error', { category: 'api', route: 'GET /api/admin/hospitals', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.hospitals.access' });

/**
 * POST /api/admin/hospitals
 * Create a new hospital
 * Access control: Only admin and group-admin can create hospitals
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Only admin and group-admin can create hospitals
    if (!['admin', 'group-admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const v = validateBody(body, createHospitalSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Verify group exists and belongs to tenant
    const group = await prisma.orgGroup.findFirst({
      where: { tenantId: tenant.id, id: data.groupId },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found or access denied' },
        { status: 404 }
      );
    }

    // If group-admin, verify they can only create hospitals in their group
    if (role === 'group-admin' && user.groupId !== data.groupId) {
      return NextResponse.json(
        { error: 'Cannot create hospital in another group' },
        { status: 403 }
      );
    }

    // Check if code already exists for this group
    const existingHospital = await prisma.hospital.findFirst({
      where: { tenantId: tenant.id, code: data.code, groupId: data.groupId },
    });

    if (existingHospital) {
      return NextResponse.json(
        { error: 'Hospital with this code already exists in this group' },
        { status: 400 }
      );
    }

    // Create hospital
    const newHospital = await prisma.hospital.create({
      data: {
        tenantId: tenant.id,
        name: data.name,
        code: data.code,
        groupId: data.groupId,
        isActive: data.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create audit log - with tenant isolation
    await createAuditLog('hospital', newHospital.id, 'create', userId, user.email, undefined, tenantId);

    return NextResponse.json({
      success: true,
      hospital: newHospital,
    });
  } catch (error) {
    logger.error('Create hospital error', { category: 'api', route: 'POST /api/admin/hospitals', error });

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
}, { tenantScoped: true, permissionKey: 'admin.hospitals.access' });
