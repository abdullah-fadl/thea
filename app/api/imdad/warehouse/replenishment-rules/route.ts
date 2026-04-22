/**
 * SCM BC2 Warehouse — Replenishment Rules
 *
 * GET  /api/imdad/warehouse/replenishment-rules — List replenishment rules
 * POST /api/imdad/warehouse/replenishment-rules — Create replenishment rule
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List replenishment rules
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const itemId = url.searchParams.get('itemId') || undefined;
      const isActive = url.searchParams.get('isActive');

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (itemId) where.itemId = itemId;
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const [data, total] = await Promise.all([
        prisma.imdadReplenishmentRule.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadReplenishmentRule.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// POST — Create replenishment rule (unique on tenant+item+source+dest)
// ---------------------------------------------------------------------------

const createRuleSchema = z.object({
  itemId: z.string().uuid('itemId must be a valid UUID'),
  sourceLocationId: z.string().uuid('sourceLocationId must be a valid UUID'),
  destLocationId: z.string().uuid('destLocationId must be a valid UUID'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  minLevel: z.number().nonnegative(),
  maxLevel: z.number().positive(),
  replenishQty: z.number().positive(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createRuleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Validate minLevel < maxLevel
      if (data.minLevel >= data.maxLevel) {
        return NextResponse.json(
          { error: 'minLevel must be less than maxLevel' },
          { status: 400 }
        );
      }

      // Unique constraint: [tenantId, itemId, sourceLocationId, destLocationId]
      const existing = await prisma.imdadReplenishmentRule.findFirst({
        where: {
          tenantId,
          itemId: data.itemId,
          sourceLocationId: data.sourceLocationId,
          destLocationId: data.destLocationId,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A replenishment rule already exists for this item/source/destination combination' },
          { status: 409 }
        );
      }

      const rule = await prisma.imdadReplenishmentRule.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          itemId: data.itemId,
          sourceLocationId: data.sourceLocationId,
          destLocationId: data.destLocationId,
          minLevel: data.minLevel,
          maxLevel: data.maxLevel,
          replenishQty: data.replenishQty,
          isActive: data.isActive ?? true,
          metadata: data.metadata ?? undefined,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'REPLENISHMENT_RULE',
        resourceId: rule.id,
        boundedContext: 'BC2_WAREHOUSE',
        newData: rule as any,
        request: req,
      });

      return NextResponse.json({ data: rule }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.replenishment.create' }
);
