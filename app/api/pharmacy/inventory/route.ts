import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

const createInventoryBodySchema = z.object({
  medicationName: z.string().min(1, 'medicationName is required'),
  currentStock: z.number().int().min(0).default(0),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const search = req.nextUrl.searchParams.get('search') || '';
  const status = req.nextUrl.searchParams.get('status') || 'ALL';

  const where: any = { tenantId };
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if (search) {
    where.OR = [
      { medicationName: { contains: search, mode: 'insensitive' } },
      { medicationNameAr: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { batchNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status === 'OUT_OF_STOCK') {
    where.currentStock = 0;
  } else if (status === 'EXPIRED') {
    where.expiryDate = { lt: now };
  } else if (status === 'EXPIRING_SOON') {
    where.expiryDate = { gte: now, lte: ninetyDaysFromNow };
  } else if (status === 'IN_STOCK') {
    where.expiryDate = { gt: now };
    where.currentStock = { gt: 0 };
  }

  const items = await prisma.pharmacyInventory.findMany({
    where,
    orderBy: { medicationName: 'asc' },
    take: 200,
  });

  // For LOW_STOCK filter, we need to post-filter since we compare fields
  let filteredItems = items;
  if (status === 'LOW_STOCK') {
    filteredItems = items.filter((i: any) => i.currentStock > 0 && i.currentStock <= (i.minStock || 0));
  }

  // Calculate stats
  const allItems = await prisma.pharmacyInventory.findMany({
    where: { tenantId },
    take: 200,
  });
  const stats = {
    total: allItems.length,
    inStock: allItems.filter((i: any) => i.currentStock > (i.minStock || 0) && (!i.expiryDate || new Date(i.expiryDate) > now)).length,
    lowStock: allItems.filter((i: any) => i.currentStock > 0 && i.currentStock <= (i.minStock || 0)).length,
    outOfStock: allItems.filter((i: any) => i.currentStock === 0).length,
    expired: allItems.filter((i: any) => i.expiryDate && new Date(i.expiryDate) < now).length,
    expiringSoon: allItems.filter((i: any) => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      return exp >= now && exp <= ninetyDaysFromNow;
    }).length,
    totalValue: allItems.reduce((sum, i: any) => sum + ((i.currentStock || 0) * (i.unitPrice || 0)), 0),
  };

  return NextResponse.json({ items: status === 'LOW_STOCK' ? filteredItems : items, stats });
}),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, createInventoryBodySchema);
  if ('error' in v) return v.error;
  const now = new Date();

  const item = await prisma.pharmacyInventory.create({
    data: {
      id: `inv_${nanoid(12)}`,
      tenantId,
      ...body,
      status: 'IN_STOCK',
      createdAt: now,
      createdBy: userId,
      lastUpdated: now,
    },
  });

  // Record initial stock movement
  if (item.currentStock > 0) {
    await prisma.pharmacyStockMovement.create({
      data: {
        id: `mov_${nanoid(12)}`,
        tenantId,
        inventoryId: item.id,
        medicationId: item.id,
        type: 'IN',
        quantity: item.currentStock,
        previousStock: 0,
        newStock: item.currentStock,
        reason: 'مخزون افتتاحي',
        createdAt: now,
        createdBy: userId,
      },
    });
  }

  await createAuditLog(
    'pharmacy_inventory',
    item.id,
    'INVENTORY_ITEM_CREATED',
    userId || 'system',
    undefined,
    { medicationName: body.medicationName, currentStock: item.currentStock },
    tenantId
  );

  return NextResponse.json({ success: true, item });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.edit' }
);
