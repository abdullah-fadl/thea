import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Laboratory turnaround time (Phase 8.4)
//
// Median elapsed minutes from when a lab order is placed (`order.placed@v1`
// with kind=LAB) to when the corresponding result is finalized
// (`lab.result.posted@v1`). Saudi MoH and CBAHI accreditation guidance
// targets routine lab TAT ≤ 60 minutes for ER stat panels and ≤ 240 minutes
// (4 h) for inpatient routine. We register the ER-stat reading as the
// dashboard headline; tenants can fork the formula with payloadFilter for
// inpatient cohorts.
//
// Source events (BOTH already emitted as of Phase 7.4):
//   - order.placed@v1          (filtered to kind === 'LAB')
//   - lab.result.posted@v1
// =============================================================================

export const labTurnaroundTimeMinutesDefinition: OutcomeDefinition = {
  key: 'saudi.lab.turnaround_time_minutes',
  name: 'Laboratory Turnaround Time (Saudi MoH)',
  description:
    'Median minutes from lab order placement to result finalization. Saudi MoH ER-stat target ≤ 60 min; routine inpatient ≤ 240 min.',
  unit: 'minutes',
  direction: 'lower_is_better',
  target: 60,
  targetTolerance: 15,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'order.placed@v1',
    endEvent: 'lab.result.posted@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'minutes',
  },
  tags: ['saudi', 'moh', 'cbahi', 'lab', 'turnaround-time'],
  status: 'active',
};

export function registerLabTurnaroundTimeMinutes(): void {
  registerOutcome(labTurnaroundTimeMinutesDefinition);
}
