/**
 * SCM BC4 Financial — Cost Centers
 *
 * GET  /api/imdad/financial/cost-centers — List cost centers with optional hierarchy
 * POST /api/imdad/financial/cost-centers — Create a new cost center
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadCostCenter with optional tree structure
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const isActive = url.searchParams.get('isActive');
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const tree = url.searchParams.get('tree') === 'true';

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (tree) {
      // Return top-level cost centers with children included
      where.parentId = null;
      const roots = await prisma.imdadCostCenter.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 500,
        include: {
          children: {
            where: { tenantId, isDeleted: false },
            include: {
              children: {
                where: { tenantId, isDeleted: false },
                orderBy: { code: 'asc' },
              },
            },
            orderBy: { code: 'asc' },
          },
        } as any,
      });

      return NextResponse.json({ items: roots, total: roots.length });
    }

    const [items, total] = await Promise.all([
      prisma.imdadCostCenter.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadCostCenter.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadCostCenter
// ---------------------------------------------------------------------------
const createCostCenterSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  parentId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  glAccountCode: z.string().optional(),
  managerUserId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createCostCenterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate parent exists if provided
    if (data.parentId) {
      const parent = await prisma.imdadCostCenter.findFirst({
        where: { id: data.parentId, tenantId, isDeleted: false },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent cost center not found' }, { status: 404 });
      }
    }

    try {
      const costCenter = await prisma.imdadCostCenter.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          code: data.code,
          name: data.name,
          nameAr: data.nameAr,
          parentId: data.parentId,
          departmentId: data.departmentId,
          glAccountCode: data.glAccountCode,
          managerUserId: data.managerUserId,
          isActive: data.isActive ?? true,
          metadata: data.metadata,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'cost_center',
        resourceId: costCenter.id,
        boundedContext: 'BC4_FINANCIAL',
        newData: costCenter as any,
        request: req,
      });

      return NextResponse.json({ costCenter }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Cost center code already exists for this organization' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.costcenter.create' }
);
