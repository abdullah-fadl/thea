import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — 30-day readmission rate (Phase 8.4)
//
// Ratio of `encounter.opened@v1` events to `encounter.closed@v1` events
// within the same period — a coarse readmission proxy that any tenant can
// run from the cross-platform event bus alone, without joining clinical
// tables. The target ≤ 8 % aligns with the Saudi MoH 2024 NRC scorecard
// for adult medical/surgical units (general benchmark; cardiac and
// oncology cohorts have separate targets).
//
// True clinical 30-day readmission requires a same-patient join (a closed
// encounter followed by a re-open within 30 days). The current formula is
// an aggregate proxy — once Phase 8.5 introduces a `cohort` formula kind
// with per-patient lookback, this outcome will graduate. Documented as a
// known limitation.
//
// Source events (BOTH already emitted as of Phase 7.4):
//   - encounter.opened@v1   (numerator — re-opens within the window)
//   - encounter.closed@v1   (denominator — completed encounters)
// =============================================================================

export const thirtyDayReadmissionRateDefinition: OutcomeDefinition = {
  key: 'saudi.encounter.thirty_day_readmission_rate_pct',
  name: '30-Day Readmission Rate (Saudi MoH proxy)',
  description:
    'Period proxy for readmission burden — ratio of encounter.opened to encounter.closed in a 30-day window. Saudi MoH NRC adult medical/surgical target ≤ 8 %. Patient-level cohort join lands in Phase 8.5.',
  unit: '%',
  direction: 'lower_is_better',
  target: 8,
  targetTolerance: 2,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'encounter.opened@v1',
    denominatorEvent: 'encounter.closed@v1',
  },
  tags: ['saudi', 'moh', 'nrc', 'encounter', 'readmission', 'proxy'],
  status: 'active',
};

export function registerThirtyDayReadmissionRate(): void {
  registerOutcome(thirtyDayReadmissionRateDefinition);
}
