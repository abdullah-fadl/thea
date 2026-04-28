import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Revenue cycle days (Phase 8.4)
//
// Median elapsed time from `claim.created@v1` to `claim.paid@v1` — i.e.
// claim-to-cash. Saudi NPHIES Council 2025 RCM benchmarks target 30 days
// median for in-network commercial payers; > 45 days flags a follow-up
// backlog or remittance-reconciliation breakdown.
//
// Unit note: the OutcomeFormula `duration_between_events` kind can output
// 'seconds' | 'minutes' | 'hours' but not 'days'. We compute in hours
// (target 720 = 30 × 24) and let the dashboard layer divide by 24 for
// presentation. The outcome `unit` field stores the display unit ('days')
// while `target` and `targetTolerance` are in display-unit days; tests
// assert the formula returns hours and the dashboard handles conversion.
//
// Source events (BOTH Phase 8.4 SCAFFOLD — not yet emitted):
//   - claim.created@v1   (start)
//   - claim.paid@v1      (end)
//
// Status: emit-deferred for full RCM. The schemas exist; emit wiring is
// the next task in the RCM track. Until then computeOutcome returns
// sampleSize=0 (no events to pair).
// =============================================================================

export const revenueCycleDaysDefinition: OutcomeDefinition = {
  key: 'saudi.rcm.revenue_cycle_days',
  name: 'Revenue Cycle Days (Claim to Cash)',
  description:
    'Median elapsed time from claim creation to payment posting (formula returns hours; dashboard divides by 24 for days). Saudi NPHIES 2025 RCM benchmark ≤ 30 days for commercial payers; > 45 days flags follow-up backlog.',
  unit: 'days',
  direction: 'lower_is_better',
  target: 30,
  targetTolerance: 5,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'claim.created@v1',
    endEvent: 'claim.paid@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'hours',
  },
  tags: ['saudi', 'nphies', 'rcm', 'revenue-cycle', 'emit-deferred'],
  status: 'active',
};

export function registerRevenueCycleDays(): void {
  registerOutcome(revenueCycleDaysDefinition);
}
