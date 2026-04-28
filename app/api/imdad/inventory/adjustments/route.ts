/**
 * SCM Inventory Adjustments — BC1 Inventory
 *
 * GET  /api/imdad/inventory/adjustments  — List adjustments
 * POST /api/imdad/inventory/adjustments  — Create adjustment (PENDING approval)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadInventoryAdjustment
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const itemId = url.searchParams.get('itemId') || undefined;
    const locationId = url.searchParams.get('locationId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (itemId) where.itemId = itemId;
    if (locationId) where.locationId = locationId;

    const [adjustments, total] = await Promise.all([
      prisma.imdadInventoryAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadInventoryAdjustment.count({ where }),
    ]);

    return NextResponse.json({
      adjustments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadInventoryAdjustment in PENDING status
// ---------------------------------------------------------------------------
const createAdjustmentSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  itemId: z.string().min(1, 'itemId is required'),
  locationId: z.string().min(1, 'locationId is required'),
  adjustmentType: z.string().min(1, 'adjustmentType is required'),
  quantityChange: z.number().int({ message: 'quantityChange must be an integer' }),
  reason: z.string().min(1, 'reason is required'),
  notes: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify item and location exist
    const [item, location] = await Promise.all([
      prisma.imdadItemMaster.findFirst({
        where: { id: data.itemId, tenantId, isDeleted: false },
        select: { id: true },
      }),
      prisma.imdadInventoryLocation.findFirst({
        where: { id: data.locationId, tenantId, isDeleted: false },
        select: { id: true },
      }),
    ]);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const adjustment = await prisma.imdadInventoryAdjustment.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        itemId: data.itemId,
        locationId: data.locationId,
        quantityChange: data.quantityChange,
        reason: data.reason as any,
        status: 'PENDING',
        requestedBy: userId,
        previousStock: 0,
        newStock: data.quantityChange,
        adjustmentNumber: `ADJ-${Date.now()}`,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'ADJUST',
      resourceType: 'INVENTORY_ADJUSTMENT',
      resourceId: adjustment.id,
      boundedContext: 'BC1_INVENTORY',
      newData: adjustment as any,
      request: req,
    });

    return NextResponse.json({ adjustment }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.adjust' }
);
