/**
 * SCM Inventory Item Detail — BC1 Item Master
 *
 * GET    /api/imdad/inventory/items/[id]  — Get single item
 * PUT    /api/imdad/inventory/items/[id]  — Update item (optimistic locking)
 * DELETE /api/imdad/inventory/items/[id]  — Soft delete item
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single ImdadItemMaster by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const item = await prisma.imdadItemMaster.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadItemMaster with optimistic locking
// ---------------------------------------------------------------------------
const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  itemType: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategory: z.string().optional(),
  baseUomId: z.string().uuid().optional(),
  purchaseUomId: z.string().uuid().optional(),
  dispensingUomId: z.string().uuid().optional(),
  status: z.string().optional(),
  standardCost: z.number().optional(),
  lastPurchaseCost: z.number().optional(),
  requiresSerialTracking: z.boolean().optional(),
  requiresBatchTracking: z.boolean().optional(),
  requiresColdChain: z.boolean().optional(),
  minShelfLifeDays: z.number().int().optional(),
  manufacturer: z.string().optional(),
  barcode: z.string().optional(),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  version: z.number().int({ message: 'version is required for optimistic locking' }),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, ...updateFields } = parsed.data;

    // Optimistic locking: only update if version matches
    const existing = await prisma.imdadItemMaster.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Conflict: item was modified by another user. Please refresh and retry.' },
        { status: 409 }
      );
    }

    const updated = await prisma.imdadItemMaster.update({
      where: { id },
      data: {
        ...updateFields,
        version: { increment: 1 },
        updatedBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'ITEM_MASTER',
      resourceId: id,
      boundedContext: 'BC1_INVENTORY',
      previousData: existing as any,
      newData: updated as any,
      request: req,
    });

    return NextResponse.json({ item: updated });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.edit' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete ImdadItemMaster
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const existing = await prisma.imdadItemMaster.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.imdadItemMaster.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'DELETE',
      resourceType: 'ITEM_MASTER',
      resourceId: id,
      boundedContext: 'BC1_INVENTORY',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ success: true, id });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.delete' }
);
