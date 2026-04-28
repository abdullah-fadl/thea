/**
 * SCM BC2 Warehouse — Single Replenishment Rule
 *
 * GET    /api/imdad/warehouse/replenishment-rules/[id] — Get replenishment rule by id
 * PUT    /api/imdad/warehouse/replenishment-rules/[id] — Update replenishment rule (optimistic locking)
 * DELETE /api/imdad/warehouse/replenishment-rules/[id] — Soft-delete replenishment rule
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Get ImdadReplenishmentRule by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const rule = await prisma.imdadReplenishmentRule.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Replenishment rule not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rule });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadReplenishmentRule (optimistic locking via version)
// ---------------------------------------------------------------------------
const updateRuleSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  itemId: z.string().uuid().optional(),
  sourceLocationId: z.string().uuid().optional(),
  destLocationId: z.string().uuid().optional(),
  minLevel: z.number().nonnegative().optional(),
  maxLevel: z.number().positive().optional(),
  replenishQty: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, ...updates } = parsed.data;

    const existing = await prisma.imdadReplenishmentRule.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Replenishment rule not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    // Validate minLevel < maxLevel if both are being set or one is changing
    const effectiveMin = updates.minLevel ?? existing.minLevel;
    const effectiveMax = updates.maxLevel ?? existing.maxLevel;
    if (effectiveMin >= effectiveMax) {
      return NextResponse.json(
        { error: 'minLevel must be less than maxLevel' },
        { status: 400 }
      );
    }

    const oldData = { ...existing } as any;

    const rule = await prisma.imdadReplenishmentRule.update({
      where: { id },
      data: {
        ...updates,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'REPLENISHMENT_RULE',
      resourceId: rule.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: oldData,
      newData: rule as any,
      request: req,
    });

    return NextResponse.json({ data: rule });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.replenishment.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadReplenishmentRule
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const existing = await prisma.imdadReplenishmentRule.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Replenishment rule not found' }, { status: 404 });
    }

    const rule = await prisma.imdadReplenishmentRule.update({
      where: { id },
      data: {
        isDeleted: true,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'DELETE',
      resourceType: 'REPLENISHMENT_RULE',
      resourceId: rule.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ data: { id: rule.id, deleted: true } });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.replenishment.delete' }
);
