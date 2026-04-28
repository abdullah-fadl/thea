/**
 * Consumable Store Inventory Management
 * Handles stock levels, movements, reordering, and transfers.
 */
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';

// Models accessed dynamically — not yet in generated Prisma client typings
const db = prisma as Record<string, any>;

export type MovementType = 'RECEIVE' | 'ISSUE' | 'RETURN' | 'ADJUST' | 'WASTE' | 'TRANSFER' | 'COUNT';

function computeStatus(qty: number, reorderLevel: number, expiryDate?: Date | null): string {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (expiryDate && new Date(expiryDate) < new Date()) return 'EXPIRED';
  if (qty <= reorderLevel) return 'LOW';
  return 'IN_STOCK';
}

export async function adjustStoreItem(args: {
  tenantId: string;
  storeId: string;
  supplyCatalogId: string;
  movementType: MovementType;
  quantity: number;
  reason?: string;
  encounterCoreId?: string;
  patientMasterId?: string;
  batchNumber?: string;
  reference?: string;
  userId?: string;
}): Promise<{ item: any; movement: any }> {
  const { tenantId, storeId, supplyCatalogId, movementType, quantity, reason, encounterCoreId, patientMasterId, batchNumber, reference, userId } = args;

  let item = await db.consumableStoreItem.findFirst({
    where: { tenantId, storeId, supplyCatalogId },
  });

  const previousQty = item ? item.currentQty : 0;
  let newQty = previousQty;

  switch (movementType) {
    case 'RECEIVE':
    case 'RETURN':
      newQty = previousQty + quantity;
      break;
    case 'ISSUE':
    case 'WASTE':
      newQty = Math.max(0, previousQty - quantity);
      break;
    case 'ADJUST':
    case 'COUNT':
      newQty = quantity;
      break;
    case 'TRANSFER':
      newQty = Math.max(0, previousQty - quantity);
      break;
  }

  const reorderLevel = item?.reorderLevel ?? 0;
  const expiryDate = item?.expiryDate ?? null;
  const status = computeStatus(newQty, reorderLevel, expiryDate);
  const now = new Date();

  if (item) {
    item = await db.consumableStoreItem.update({
      where: { id: item.id },
      data: {
        currentQty: newQty,
        status,
        ...(batchNumber ? { batchNumber } : {}),
        ...(movementType === 'COUNT' ? { lastCountedAt: now, lastCountedBy: userId } : {}),
        updatedAt: now,
      },
    });
  } else {
    item = await db.consumableStoreItem.create({
      data: {
        id: uuidv4(),
        tenantId,
        storeId,
        supplyCatalogId,
        currentQty: newQty,
        reorderLevel: 0,
        maxLevel: 0,
        batchNumber: batchNumber || null,
        status,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const movement = await db.consumableStockMovement.create({
    data: {
      id: uuidv4(),
      tenantId,
      storeId,
      supplyCatalogId,
      movementType,
      quantity,
      previousQty,
      newQty,
      reason: reason || null,
      encounterCoreId: encounterCoreId || null,
      patientMasterId: patientMasterId || null,
      batchNumber: batchNumber || null,
      reference: reference || null,
      createdAt: now,
      createdBy: userId || null,
    },
  });

  return { item, movement };
}

export async function getStoreInventory(tenantId: string, storeId: string, opts?: { status?: string; search?: string }) {
  const where: any = { tenantId, storeId };
  if (opts?.status && opts.status !== 'ALL') {
    where.status = opts.status;
  }

  const items = await db.consumableStoreItem.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  const supplyIds = items.map((i: any) => i.supplyCatalogId);
  const supplies = supplyIds.length
    ? await prisma.suppliesCatalog.findMany({
        where: { tenantId, id: { in: supplyIds } },
      })
    : [];
  const supplyMap = new Map(supplies.map((s: any) => [s.id, s]));

  const enriched = items.map((item: any) => {
    const supply = supplyMap.get(item.supplyCatalogId) as Record<string, unknown> | undefined;
    return {
      ...item,
      supplyName: supply?.name || 'Unknown',
      supplyCode: supply?.code || '',
      category: supply?.category || '',
    };
  });

  if (opts?.search) {
    const q = opts.search.toLowerCase();
    return enriched.filter((i: any) =>
      i.supplyName.toLowerCase().includes(q) || i.supplyCode.toLowerCase().includes(q)
    );
  }

  return enriched;
}

export async function getStoreStats(tenantId: string, storeId: string) {
  const items = await db.consumableStoreItem.findMany({
    where: { tenantId, storeId },
  });

  return {
    total: items.length,
    inStock: items.filter((i: any) => i.status === 'IN_STOCK').length,
    low: items.filter((i: any) => i.status === 'LOW').length,
    outOfStock: items.filter((i: any) => i.status === 'OUT_OF_STOCK').length,
    expired: items.filter((i: any) => i.status === 'EXPIRED').length,
  };
}

export async function getMovementHistory(tenantId: string, storeId: string, opts?: { supplyCatalogId?: string; limit?: number }) {
  const where: any = { tenantId, storeId };
  if (opts?.supplyCatalogId) where.supplyCatalogId = opts.supplyCatalogId;

  return db.consumableStockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts?.limit || 50,
  });
}

export async function getLowStockAlerts(tenantId: string) {
  const items = await db.consumableStoreItem.findMany({
    where: {
      tenantId,
      status: { in: ['LOW', 'OUT_OF_STOCK'] },
    },
    orderBy: { currentQty: 'asc' },
  });

  const supplyIds = items.map((i: any) => i.supplyCatalogId);
  const supplies = supplyIds.length
    ? await prisma.suppliesCatalog.findMany({
        where: { tenantId, id: { in: supplyIds } },
      })
    : [];
  const supplyMap = new Map(supplies.map((s: any) => [s.id, s]));

  const storeIds = [...new Set(items.map((i: any) => i.storeId))] as string[];
  const stores = storeIds.length
    ? await db.consumableStore.findMany({
        where: { tenantId, id: { in: storeIds } },
      })
    : [];
  const storeMap = new Map(stores.map((s: any) => [s.id, s]));

  return items.map((item: any) => ({
    ...item,
    supplyName: (supplyMap.get(item.supplyCatalogId) as Record<string, unknown> | undefined)?.name || 'Unknown',
    supplyCode: (supplyMap.get(item.supplyCatalogId) as Record<string, unknown> | undefined)?.code || '',
    storeName: (storeMap.get(item.storeId) as Record<string, unknown> | undefined)?.name || 'Unknown',
    storeCode: (storeMap.get(item.storeId) as Record<string, unknown> | undefined)?.code || '',
  }));
}
