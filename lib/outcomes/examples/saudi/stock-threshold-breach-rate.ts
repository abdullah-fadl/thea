import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Stock threshold breach count (Phase 8.4)
//
// Period count of `stock.threshold_breached@v1` events. The Imdad
// procurement platform fires this whenever an inventory KPI breaches a
// preconfigured threshold (low-stock, expiry-imminent, par-level miss).
// SFDA pharmacy-management standards expect ≤ 20 critical breaches per
// month for a typical 200-bed hospital pharmacy stock; sustained > 40
// indicates a forecasting or supplier-lead-time issue.
//
// The framework can't easily express "per 1,000 inventory items" without
// a known catalog-size denominator on the bus, so we headline the raw
// count and let the dashboard normalise per tenant. CRITICAL severity is
// the operational signal — INFO/WARNING breaches are noisier and tracked
// separately in Imdad's own KPI views.
//
// Source events (already emitted as of Phase 7.5):
//   - stock.threshold_breached@v1  (filtered to severity === 'CRITICAL')
// =============================================================================

export const stockThresholdBreachRateDefinition: OutcomeDefinition = {
  key: 'saudi.imdad.stock_critical_breach_count',
  name: 'Critical Stock Threshold Breaches',
  description:
    'Count of CRITICAL stock-threshold breach alerts per period. SFDA expectation ≤ 20 / month for a 200-bed pharmacy; sustained > 40 flags a forecasting or supplier-lead-time issue.',
  unit: 'count',
  direction: 'lower_is_better',
  target: 20,
  targetTolerance: 10,
  formula: {
    kind: 'count',
    eventName: 'stock.threshold_breached@v1',
    payloadFilter: { severity: 'CRITICAL' },
  },
  tags: ['saudi', 'sfda', 'imdad', 'inventory', 'stock-breach'],
  status: 'active',
};

export function registerStockThresholdBreachRate(): void {
  registerOutcome(stockThresholdBreachRateDefinition);
}
