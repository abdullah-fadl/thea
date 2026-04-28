import { allocateChargeCatalogCode } from './chargeCatalogCode';

/**
 * Allocate a medication catalog code (MED-0001, MED-0002, ...).
 * Uses charge_catalog_counters with itemType MEDICATION to avoid dependency on medication_catalog_counters table.
 */
export async function allocateMedicationCatalogCode(args: { db?: any; tenantId: string }) {
  return allocateChargeCatalogCode({
    tenantId: args.tenantId,
    itemType: 'MEDICATION',
  });
}
