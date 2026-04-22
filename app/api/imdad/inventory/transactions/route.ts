/**
 * SCM Inventory Transactions — BC1 Inventory
 *
 * GET  /api/imdad/inventory/transactions  — List inventory transactions
 * POST /api/imdad/inventory/transactions  — Create transaction via stockMutate
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { stockMutate } from '@/lib/imdad/stockMutate';

// ---------------------------------------------------------------------------
// GET — List ImdadInventoryTransaction
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const itemId = url.searchParams.get('itemId') || undefined;
    const locationId = url.searchParams.get('locationId') || undefined;
    const movementType = url.searchParams.get('movementType') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    const where: any = { tenantId };

    if (organizationId) where.organizationId = organizationId;
    if (itemId) where.itemId = itemId;
    if (locationId) where.locationId = locationId;
    if (movementType) where.movementType = movementType;

    if (startDate || endDate) {
      where.performedAt = {};
      if (startDate) where.performedAt.gte = new Date(startDate);
      if (endDate) where.performedAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.imdadInventoryTransaction.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadInventoryTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create inventory transaction via stockMutate
// ---------------------------------------------------------------------------
const createTransactionSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  itemId: z.string().min(1, 'itemId is required'),
  locationId: z.string().min(1, 'locationId is required'),
  movementType: z.string().min(1, 'movementType is required'),
  quantity: z.number().int().min(1, 'quantity must be a positive integer'),
  direction: z.enum(['IN', 'OUT'], { message: 'direction must be IN or OUT' }),
  reason: z.string().min(1, 'reason is required'),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  unitCost: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Compute delta: IN = positive, OUT = negative
    const delta = data.direction === 'IN' ? data.quantity : -data.quantity;

    const result = await stockMutate({
      tenantId,
      organizationId: data.organizationId,
      itemId: data.itemId,
      locationId: data.locationId,
      delta,
      reason: data.reason,
      userId,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      unitCost: data.unitCost,
    } as any);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Stock mutation failed' },
        { status: 422 }
      );
    }

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: data.direction === 'IN' ? 'RECEIVE' : 'DISPENSE',
      resourceType: 'INVENTORY_TRANSACTION',
      resourceId: result.transactionId,
      boundedContext: 'BC1_INVENTORY',
      newData: {
        itemId: data.itemId,
        locationId: data.locationId,
        movementType: data.movementType,
        quantity: data.quantity,
        direction: data.direction,
        delta,
        previousStock: (result as any).previousStock,
        newStock: (result as any).newStock,
      },
      request: req,
    });

    return NextResponse.json(
      {
        transaction: {
          id: result.transactionId,
          previousStock: (result as any).previousStock,
          newStock: (result as any).newStock,
        },
      },
      { status: 201 }
    );
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.transact' }
);
