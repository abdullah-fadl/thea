import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — NPHIES claim approval rate (Phase 8.4)
//
// Ratio of `claim.adjudicated@v1` events with `outcome=complete` (numerator)
// to all `claim.created@v1` events (denominator) in the same period. Saudi
// NPHIES Council benchmarks for 2025 set "first-pass complete" at ≥ 85 %
// across the major payers (BUPA, Tawuniya, MedGulf); below 75 % flags an
// adjudication or coding defect cycle.
//
// Source events (BOTH Phase 8.4 SCAFFOLD — not yet emitted):
//   - claim.adjudicated@v1   (numerator, filtered to outcome === 'complete')
//   - claim.created@v1       (denominator)
//
// Status: emit-deferred — both events are in the schema registry so the
// outcome registers cleanly, but no NPHIES route emits them yet (the
// adjudicate / send wiring is the next task in the RCM track).
// =============================================================================

export const claimApprovalRatePctDefinition: OutcomeDefinition = {
  key: 'saudi.nphies.claim_approval_rate_pct',
  name: 'NPHIES Claim Approval Rate',
  description:
    'Percentage of submitted claims adjudicated with outcome=complete on first pass. Saudi NPHIES 2025 benchmark ≥ 85 %; < 75 % indicates a coding/adjudication defect cycle.',
  unit: '%',
  direction: 'higher_is_better',
  target: 85,
  targetTolerance: 5,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'claim.adjudicated@v1',
    denominatorEvent: 'claim.created@v1',
    numeratorFilter: { outcome: 'complete' },
  },
  tags: ['saudi', 'nphies', 'rcm', 'claim-approval', 'emit-deferred'],
  status: 'active',
};

export function registerClaimApprovalRatePct(): void {
  registerOutcome(claimApprovalRatePctDefinition);
}
