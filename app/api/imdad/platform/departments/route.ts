/**
 * SCM BC9 Platform — Departments
 *
 * GET  /api/imdad/platform/departments — List SCM departments with user count
 * POST /api/imdad/platform/departments — Create a new department
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadDepartment with departmentUsers count
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const isActive = url.searchParams.get('isActive');
    const search = url.searchParams.get('search')?.trim() || '';

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.imdadDepartment.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { departmentUsers: true } },
        } as any,
      }),
      prisma.imdadDepartment.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadDepartment
// ---------------------------------------------------------------------------
const createDepartmentSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  type: z.string().optional(),
  parentId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    try {
      const department = await prisma.imdadDepartment.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          code: data.code,
          name: data.name,
          nameAr: data.nameAr,
          type: data.type,
          parentId: data.parentId,
          costCenterId: data.costCenterId,
          isActive: data.isActive ?? true,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'department',
        resourceId: department.id,
        boundedContext: 'BC9_PLATFORM',
        newData: department as any,
        request: req,
      });

      return NextResponse.json({ department }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Department code already exists for this organization' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.department.create' }
);
