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
const createGroupSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/groups
 * Get all groups for the current tenant
 */
export const GET = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Only admin can view all groups
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const groups = await prisma.orgGroup.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ groups });
  } catch (error) {
    logger.error('Get groups error', { category: 'api', route: 'GET /api/admin/groups', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.groups.access' });

/**
 * POST /api/admin/groups
 * Create a new group
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Only admin can create groups
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const v = validateBody(body, createGroupSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Check if code already exists for this tenant
    const existingGroup = await prisma.orgGroup.findFirst({
      where: { tenantId: tenant.id, code: data.code },
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Group with this code already exists' },
        { status: 400 }
      );
    }

    // Create group
    const newGroup = await prisma.orgGroup.create({
      data: {
        tenantId: tenant.id,
        name: data.name,
        code: data.code,
        isActive: data.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create audit log
    await createAuditLog('group', newGroup.id, 'create', userId, user.email, undefined, tenantId);

    return NextResponse.json({
      success: true,
      group: newGroup,
    });
  } catch (error) {
    logger.error('Create group error', { category: 'api', route: 'POST /api/admin/groups', error });

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
}, { tenantScoped: true, permissionKey: 'admin.groups.access' });
