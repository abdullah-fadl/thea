import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Encounter completion rate (Phase 8.4)
//
// Ratio of `encounter.closed@v1` to `encounter.opened@v1` per period. A
// healthy OPD finishes the encounters it starts: persistently low completion
// rates flag clinic abandonment, technical drop-offs, or staffing gaps.
// CBAHI surveys typically expect ≥ 95 % closed-on-day completion; we use
// 98 % as the dashboard target with ±3 % tolerance.
//
// Source events (BOTH already emitted as of Phase 7.4):
//   - encounter.opened@v1
//   - encounter.closed@v1
// =============================================================================

export const encounterCompletionRatePctDefinition: OutcomeDefinition = {
  key: 'saudi.encounter.completion_rate_pct',
  name: 'OPD Encounter Completion Rate',
  description:
    'Percentage of opened OPD encounters that closed within the period. CBAHI same-day completion target ≥ 95 %.',
  unit: '%',
  direction: 'higher_is_better',
  target: 98,
  targetTolerance: 3,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'encounter.closed@v1',
    denominatorEvent: 'encounter.opened@v1',
  },
  tags: ['saudi', 'cbahi', 'opd', 'encounter', 'completion-rate'],
  status: 'active',
};

export function registerEncounterCompletionRatePct(): void {
  registerOutcome(encounterCompletionRatePctDefinition);
}
