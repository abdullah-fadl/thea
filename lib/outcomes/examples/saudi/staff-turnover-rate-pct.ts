import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Quarterly staff turnover (Phase 8.4)
//
// Ratio of `employee.terminated@v1` events (numerator) to
// `employee.hired@v1` events (denominator) per quarter. The Saudi
// Healthcare HR Council 2024 reference puts annualised turnover floor at
// ≤ 12 % for tertiary hospitals and ≤ 18 % for primary-care networks; per
// quarter, the dashboard target is therefore ≤ 4 % with ±1.5 % tolerance.
//
// True turnover requires (terminations / average headcount), not
// (terminations / hires). The current ratio approximates the long-run
// ratio and is a useful early-warning signal: if terminations consistently
// exceed hires (ratio > 100 %), the workforce is shrinking. Phase 8.5's
// planned `cohort` formula kind will graduate this to the proper
// (terminations / active-headcount) definition.
//
// Source events (BOTH already emitted as of Phase 7.5):
//   - employee.terminated@v1   (numerator)
//   - employee.hired@v1        (denominator)
// =============================================================================

export const staffTurnoverRatePctDefinition: OutcomeDefinition = {
  key: 'saudi.cvision.staff_turnover_ratio_pct',
  name: 'Staff Turnover Ratio (CVision)',
  description:
    'Ratio of terminations to hires per quarter as a % (early-warning proxy for true turnover). Saudi Healthcare HR Council 2024 quarterly target ≤ 4 % for tertiary, ≤ 6 % for primary care.',
  unit: '%',
  direction: 'lower_is_better',
  target: 4,
  targetTolerance: 1.5,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'employee.terminated@v1',
    denominatorEvent: 'employee.hired@v1',
  },
  tags: ['saudi', 'hr', 'cvision', 'turnover', 'proxy'],
  status: 'active',
};

export function registerStaffTurnoverRatePct(): void {
  registerOutcome(staffTurnoverRatePctDefinition);
}
