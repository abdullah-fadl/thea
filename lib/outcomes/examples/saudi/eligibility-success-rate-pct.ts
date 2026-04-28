import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — NPHIES eligibility success rate (Phase 8.4)
//
// Ratio of successful eligibility responses (numerator — `outcome=complete`)
// to all eligibility requests (denominator) within the period. The Saudi
// NPHIES Council 2025 KPI reference puts the operating floor at ≥ 90 %
// first-pass complete: lower numbers are typically caused by stale member
// numbers, payer feed outages, or a missing patient.identifier on the
// request bundle.
//
// Source events (NOT YET REGISTERED — `eligibility.requested@v1` and
// `eligibility.responded@v1` are deferred future events; the formula
// references them so the outcome graduates from sampleSize=0 to a real
// signal the moment a future phase wires them up).
//
// Status: emit-deferred — neither event is in the schema registry as of
// Phase 8.4. Outcome registers (registerOutcome doesn't validate event
// names against the schema registry); compute returns 0 until events ship.
// See NOTES.md §Phase 8.4 deferred list.
// =============================================================================

export const eligibilitySuccessRatePctDefinition: OutcomeDefinition = {
  key: 'saudi.nphies.eligibility_success_rate_pct',
  name: 'NPHIES Eligibility Success Rate',
  description:
    'Percentage of NPHIES eligibility requests that returned a complete response on first pass. Saudi NPHIES 2025 floor ≥ 90 %.',
  unit: '%',
  direction: 'higher_is_better',
  target: 95,
  targetTolerance: 3,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'eligibility.responded@v1',
    denominatorEvent: 'eligibility.requested@v1',
    numeratorFilter: { outcome: 'complete' },
  },
  tags: ['saudi', 'nphies', 'eligibility', 'emit-deferred'],
  status: 'active',
};

export function registerEligibilitySuccessRatePct(): void {
  registerOutcome(eligibilitySuccessRatePctDefinition);
}
