import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

const adjustInventoryBodySchema = z.object({
  inventoryId: z.string().min(1, 'inventoryId is required'),
  adjustmentType: z.enum(['ADD', 'REMOVE', 'SET']),
  quantity: z.number(),
  reason: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  const body = await req.json();
  const v = validateBody(body, adjustInventoryBodySchema);
  if ('error' in v) return v.error;
  const { inventoryId, adjustmentType, quantity, reason } = v.data;

  const item = await prisma.pharmacyInventory.findFirst({
    where: { id: inventoryId, tenantId },
  });
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const previousStock = item.currentStock;
  let newStock: number;

  switch (adjustmentType) {
    case 'ADD':
      newStock = previousStock + quantity;
      break;
    case 'REMOVE':
      newStock = Math.max(0, previousStock - quantity);
      break;
    case 'SET':
      newStock = quantity;
      break;
    default:
      return NextResponse.json({ error: 'Invalid adjustment type' }, { status: 400 });
  }

  const now = new Date();

  await prisma.pharmacyInventory.update({
    where: { id: inventoryId },
    data: {
      currentStock: newStock,
      lastUpdated: now,
      status: newStock === 0 ? 'OUT_OF_STOCK' : newStock <= (item.minStock || 0) ? 'LOW_STOCK' : 'IN_STOCK',
    },
  });

  const movement = await prisma.pharmacyStockMovement.create({
    data: {
      id: `mov_${nanoid(12)}`,
      tenantId,
      inventoryId,
      medicationId: item.medicationId || inventoryId,
      type: adjustmentType === 'ADD' ? 'IN' : adjustmentType === 'REMOVE' ? 'OUT' : 'ADJUSTMENT',
      quantity: Math.abs(newStock - previousStock),
      previousStock,
      newStock,
      reason,
      createdAt: now,
      createdBy: userId,
      createdByName: user?.displayName || user?.email,
    },
  });

  await createAuditLog(
    'pharmacy_inventory',
    inventoryId,
    'INVENTORY_ADJUSTED',
    userId || 'system',
    user?.email,
    { adjustmentType, quantity, previousStock, newStock, reason },
    tenantId
  );

  return NextResponse.json({ success: true, newStock, movement });
}),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.edit' });
