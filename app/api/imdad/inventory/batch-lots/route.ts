/**
 * SCM Batch/Lots — BC1 Inventory
 *
 * GET  /api/imdad/inventory/batch-lots  — List batch/lot records with expiry tracking
 * POST /api/imdad/inventory/batch-lots  — Create batch/lot record
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadBatchLot
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const itemId = url.searchParams.get('itemId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const expiryBefore = url.searchParams.get('expiryBefore') || undefined;
    const expiryAfter = url.searchParams.get('expiryAfter') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (itemId) where.itemId = itemId;
    if (status) where.status = status;

    if (expiryBefore || expiryAfter) {
      where.expiryDate = {};
      if (expiryBefore) where.expiryDate.lte = new Date(expiryBefore);
      if (expiryAfter) where.expiryDate.gte = new Date(expiryAfter);
    }

    const [batchLots, total] = await Promise.all([
      prisma.imdadBatchLot.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadBatchLot.count({ where }),
    ]);

    return NextResponse.json({
      batchLots,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadBatchLot
// ---------------------------------------------------------------------------
const createBatchLotSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  itemId: z.string().min(1, 'itemId is required'),
  batchNumber: z.string().min(1, 'batchNumber is required'),
  lotNumber: z.string().optional(),
  manufacturingDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime({ message: 'expiryDate must be a valid ISO date' }),
  quantity: z.number().int().min(0, 'quantity must be non-negative'),
  locationId: z.string().optional(),
  supplierId: z.string().optional(),
  unitCost: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createBatchLotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify item exists
    const item = await prisma.imdadItemMaster.findFirst({
      where: { id: data.itemId, tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check duplicate batch number for same item
    const existingBatch = await prisma.imdadBatchLot.findFirst({
      where: {
        tenantId,
        itemId: data.itemId,
        batchNumber: data.batchNumber,
        isDeleted: false,
      },
    });
    if (existingBatch) {
      return NextResponse.json(
        { error: 'Batch number already exists for this item' },
        { status: 409 }
      );
    }

    const batchLot = await prisma.imdadBatchLot.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        itemId: data.itemId,
        batchNumber: data.batchNumber,
        lotNumber: data.lotNumber,
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : undefined,
        expiryDate: new Date(data.expiryDate),
        quantity: data.quantity,
        supplierId: data.supplierId,
        unitCost: data.unitCost,
        status: (data.status || 'ACTIVE') as any,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'BATCH_LOT',
      resourceId: batchLot.id,
      boundedContext: 'BC1_INVENTORY',
      newData: batchLot as any,
      request: req,
    });

    return NextResponse.json({ batchLot }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.create' }
);
