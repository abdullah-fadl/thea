/**
 * SCM BC5 Clinical — Ward PAR Levels
 *
 * GET  /api/imdad/clinical/ward-par-levels — List ward PAR levels with pagination, search, filters
 * POST /api/imdad/clinical/ward-par-levels — Create ward PAR level
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List ward PAR levels
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, departmentId, itemId, locationId, isActive } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (departmentId) where.departmentId = departmentId;
      if (itemId) where.itemId = itemId;
      if (locationId) where.locationId = locationId;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { itemCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadWardParLevel.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadWardParLevel.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.ward.list' }
);

// ---------------------------------------------------------------------------
// POST — Create ward PAR level
// ---------------------------------------------------------------------------

const createParLevelSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1).max(50),
  itemName: z.string().min(1),
  parLevel: z.number().int().nonnegative(),
  maxLevel: z.number().int().nonnegative(),
  reorderQty: z.number().int().nonnegative(),
  unitOfMeasure: z.string().min(1),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createParLevelSchema.parse(body);

      // Duplicate check: departmentId + itemId must be unique within tenant
      const existing = await prisma.imdadWardParLevel.findFirst({
        where: { tenantId, departmentId: parsed.departmentId, itemId: parsed.itemId, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ward PAR level for this item in this department already exists' }, { status: 409 });
      }

      const wardParLevel = await prisma.imdadWardParLevel.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          departmentId: parsed.departmentId,
          locationId: parsed.locationId,
          itemId: parsed.itemId,
          itemCode: parsed.itemCode,
          itemName: parsed.itemName,
          parLevel: parsed.parLevel,
          maxLevel: parsed.maxLevel,
          reorderQty: parsed.reorderQty,
          unitOfMeasure: parsed.unitOfMeasure,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'WARD_PAR_LEVEL',
        resourceId: wardParLevel.id,
        boundedContext: 'BC5_CLINICAL',
        newData: wardParLevel as any,
        request: req,
      });

      return NextResponse.json({ data: wardParLevel }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.ward.create' }
);
