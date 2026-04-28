/**
 * Nursing Consumable Usage Recording — Core Feature
 * Records consumable usage against encounters, creates charge events,
 * deducts from store inventory, and emits notifications.
 */
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { adjustStoreItem } from './inventory';

// Consumable models accessed via Prisma client
const db = prisma;

export interface ConsumableUsageInput {
  supplyCatalogId: string;
  supplyCode: string;
  supplyName: string;
  quantity: number;
  wasteQty?: number;
  usageContext: string;
  notes?: string;
  storeId?: string;
  costPrice?: number;
  isChargeable?: boolean;
}

export interface ProcessConsumableUsageArgs {
  tenantId: string;
  encounterCoreId: string;
  patientMasterId?: string;
  department: string;
  items: ConsumableUsageInput[];
  templateId?: string;
  userId: string;
  userName?: string;
  idempotencyKey?: string;
}

export interface ProcessConsumableUsageResult {
  usageEvents: any[];
  chargeEvents: any[];
  inventoryUpdates: any[];
  totalCharged: number;
}

export async function processConsumableUsage(args: ProcessConsumableUsageArgs): Promise<ProcessConsumableUsageResult> {
  const {
    tenantId,
    encounterCoreId,
    patientMasterId,
    department,
    items,
    templateId,
    userId,
    userName,
    idempotencyKey,
  } = args;

  // Idempotency check
  if (idempotencyKey) {
    const existing = await db.consumableUsageEvent.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return { usageEvents: [existing], chargeEvents: [], inventoryUpdates: [], totalCharged: 0 };
    }
  }

  const usageEvents: any[] = [];
  const chargeEvents: any[] = [];
  const inventoryUpdates: any[] = [];
  let totalCharged = 0;
  const now = new Date();

  for (const item of items) {
    if (item.quantity <= 0) continue;

    const totalCost = (item.costPrice || 0) * item.quantity;
    const eventId = uuidv4();
    const eventIdempotencyKey = idempotencyKey ? `${idempotencyKey}:${item.supplyCatalogId}` : null;

    // 1) Create usage event
    const usageEvent = await db.consumableUsageEvent.create({
      data: {
        id: eventId,
        tenantId,
        encounterCoreId,
        patientMasterId: patientMasterId || null,
        department,
        supplyCatalogId: item.supplyCatalogId,
        supplyCode: item.supplyCode,
        supplyName: item.supplyName,
        quantity: item.quantity,
        wasteQty: item.wasteQty || 0,
        storeId: item.storeId || null,
        usageContext: item.usageContext,
        notes: item.notes || null,
        templateId: templateId || null,
        isChargeable: item.isChargeable !== false,
        costPrice: item.costPrice || null,
        totalCost: totalCost || null,
        status: 'RECORDED',
        idempotencyKey: eventIdempotencyKey,
        createdAt: now,
        createdBy: userId,
        createdByName: userName || null,
      },
    });
    usageEvents.push(usageEvent);

    // 2) Create charge event if chargeable
    if (item.isChargeable !== false) {
      // Look up the charge catalog entry for this supply
      const supply = await prisma.suppliesCatalog.findFirst({
        where: { tenantId, id: item.supplyCatalogId },
      });

      if (supply?.chargeCatalogId) {
        const charge = await prisma.billingChargeCatalog.findFirst({
          where: { tenantId, id: supply.chargeCatalogId },
        });

        if (charge) {
          const unitPrice = Number(charge.basePrice || 0);
          const chargeTotal = unitPrice * item.quantity;
          totalCharged += chargeTotal;

          const chargeEvent = await prisma.billingChargeEvent.create({
            data: {
              id: uuidv4(),
              tenantId,
              encounterCoreId,
              patientMasterId: patientMasterId || null,
              departmentKey: department,
              source: { type: 'CONSUMABLE', usageEventId: eventId },
              chargeCatalogId: supply.chargeCatalogId,
              code: charge.code,
              name: charge.name,
              unitType: charge.unitType,
              quantity: item.quantity,
              unitPrice,
              totalPrice: chargeTotal,
              payerType: 'CASH',
              status: 'ACTIVE',
              idempotencyKey: eventIdempotencyKey ? `charge:${eventIdempotencyKey}` : null,
              createdAt: now,
              createdBy: userId,
            },
          });
          chargeEvents.push(chargeEvent);

          // Link charge event back
          await db.consumableUsageEvent.update({
            where: { id: eventId },
            data: { chargeEventId: chargeEvent.id },
          });
        }
      }
    }

    // 3) Deduct from store inventory
    if (item.storeId) {
      const totalDeduct = item.quantity + (item.wasteQty || 0);
      const result = await adjustStoreItem({
        tenantId,
        storeId: item.storeId,
        supplyCatalogId: item.supplyCatalogId,
        movementType: 'ISSUE',
        quantity: totalDeduct,
        reason: `Usage: ${item.usageContext} - ${encounterCoreId}`,
        encounterCoreId,
        patientMasterId,
        reference: eventId,
        userId,
      });
      inventoryUpdates.push(result);

      // If waste, record separate waste movement
      if (item.wasteQty && item.wasteQty > 0) {
        await adjustStoreItem({
          tenantId,
          storeId: item.storeId,
          supplyCatalogId: item.supplyCatalogId,
          movementType: 'WASTE',
          quantity: 0, // already deducted above
          reason: `Waste from usage: ${item.usageContext}`,
          encounterCoreId,
          reference: `waste:${eventId}`,
          userId,
        });
      }
    }
  }

  return { usageEvents, chargeEvents, inventoryUpdates, totalCharged };
}

export async function voidConsumableUsage(args: {
  tenantId: string;
  usageEventId: string;
  reason: string;
  userId: string;
}): Promise<{ usageEvent: any; chargeVoided: boolean }> {
  const { tenantId, usageEventId, reason, userId } = args;
  const now = new Date();

  const usageEvent = await db.consumableUsageEvent.findFirst({
    where: { tenantId, id: usageEventId, status: 'RECORDED' },
  });

  if (!usageEvent) throw new Error('Usage event not found or already voided');

  // Void the usage event
  await db.consumableUsageEvent.update({
    where: { id: usageEventId },
    data: {
      status: 'VOIDED',
      voidedAt: now,
      voidedBy: userId,
      voidReason: reason,
    },
  });

  // Void linked charge event
  let chargeVoided = false;
  const chargeEventId = (usageEvent as Record<string, unknown>).chargeEventId as string | undefined;
  if (chargeEventId) {
    await prisma.billingChargeEvent.updateMany({
      where: { tenantId, id: chargeEventId, status: 'ACTIVE' },
      data: {
        status: 'VOID',
        reason,
        voidedAt: now,
        voidedBy: userId,
      },
    });
    chargeVoided = true;
  }

  // Return to store inventory
  const evt = usageEvent as Record<string, unknown>;
  if (evt.storeId) {
    const totalReturn = Number(evt.quantity || 0) + Number(evt.wasteQty || 0);
    await adjustStoreItem({
      tenantId,
      storeId: evt.storeId as string,
      supplyCatalogId: evt.supplyCatalogId as string,
      movementType: 'RETURN',
      quantity: totalReturn,
      reason: `Void: ${reason}`,
      encounterCoreId: evt.encounterCoreId as string,
      reference: `void:${usageEventId}`,
      userId,
    });
  }

  return { usageEvent, chargeVoided };
}

export async function getEncounterConsumables(tenantId: string, encounterCoreId: string) {
  return db.consumableUsageEvent.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getConsumableSummaryForEncounter(tenantId: string, encounterCoreId: string) {
  const events = await db.consumableUsageEvent.findMany({
    where: { tenantId, encounterCoreId, status: 'RECORDED' },
  });

  const totalItems = events.reduce((sum: number, e: any) => sum + e.quantity, 0);
  const totalWaste = events.reduce((sum: number, e: any) => sum + (e.wasteQty || 0), 0);
  const totalCost = events.reduce((sum: number, e: any) => sum + Number(e.totalCost || 0), 0);
  const chargeableCount = events.filter((e: any) => e.isChargeable).length;

  return {
    eventCount: events.length,
    totalItems,
    totalWaste,
    totalCost: Math.round(totalCost * 100) / 100,
    chargeableCount,
    events,
  };
}
