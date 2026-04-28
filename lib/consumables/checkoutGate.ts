/**
 * Consumable Checkout Gate
 * Verifies all consumables are properly recorded and charged before discharge.
 */
import { prisma, prismaModel } from '@/lib/db/prisma';

// Access consumable models that may not yet be in generated Prisma client
const db = { consumableUsageEvent: prismaModel('consumableUsageEvent') };

export interface CheckoutGateResult {
  pass: boolean;
  totalConsumableCharges: number;
  pendingItems: number;
  uncharged: any[];
  warnings: string[];
}

export async function runConsumableCheckoutGate(
  tenantId: string,
  encounterCoreId: string
): Promise<CheckoutGateResult> {
  const usageEvents = await db.consumableUsageEvent.findMany({
    where: { tenantId, encounterCoreId, status: 'RECORDED' },
  });

  const warnings: string[] = [];
  const uncharged: any[] = [];
  let totalConsumableCharges = 0;
  let pendingItems = 0;

  for (const event of usageEvents) {
    const e = event as Record<string, unknown>;
    if (e.isChargeable && !e.chargeEventId) {
      uncharged.push({
        id: e.id,
        supplyName: e.supplyName,
        quantity: e.quantity,
        costPrice: e.costPrice,
      });
      pendingItems++;
    }
    if (e.chargeEventId) {
      totalConsumableCharges += Number(e.totalCost || 0);
    }
  }

  if (uncharged.length > 0) {
    warnings.push(`${uncharged.length} consumable(s) used but not charged`);
  }

  const wasteEvents = usageEvents.filter((e: any) => (e.wasteQty || 0) > 0);
  if (wasteEvents.length > 0) {
    const totalWaste = wasteEvents.reduce((s: number, e: any) => s + (e.wasteQty || 0), 0);
    warnings.push(`${totalWaste} unit(s) recorded as waste across ${wasteEvents.length} event(s)`);
  }

  return {
    pass: uncharged.length === 0,
    totalConsumableCharges: Math.round(totalConsumableCharges * 100) / 100,
    pendingItems,
    uncharged,
    warnings,
  };
}
