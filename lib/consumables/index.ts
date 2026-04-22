export { adjustStoreItem, getStoreInventory, getStoreStats, getMovementHistory, getLowStockAlerts } from './inventory';
export { processConsumableUsage, voidConsumableUsage, getEncounterConsumables, getConsumableSummaryForEncounter } from './usageRecording';
export { runConsumableCheckoutGate } from './checkoutGate';
export { CONSUMABLE_SEED_ITEMS, CONSUMABLE_USAGE_TEMPLATES } from './seedCatalog';
export type { ConsumableUsageInput, ProcessConsumableUsageArgs, ProcessConsumableUsageResult } from './usageRecording';
export type { CheckoutGateResult } from './checkoutGate';
export type { SeedConsumableItem } from './seedCatalog';
