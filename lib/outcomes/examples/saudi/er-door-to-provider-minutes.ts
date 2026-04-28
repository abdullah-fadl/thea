import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — ER door-to-provider time (Phase 8.4)
//
// Refines the Phase 6.3 example (lib/outcomes/examples/er-door-to-provider.ts)
// with Saudi MoH targets. The MoH 2024 ER quality framework targets a median
// door-to-provider time ≤ 30 minutes for non-critical presentations, with
// CBAHI accreditation surveys flagging ≥ 45 minutes as a corrective-action
// finding. Tolerance is set to ±5 minutes around the 30-min target so a 35
// median still reads as "on target" at the period level.
//
// Source events (Phase 6.2 ER triage agent — emitted when wired):
//   - er.patient.arrived@v1
//   - er.provider.assigned@v1
//
// Status: emit-deferred (the Phase 6.2 ER agent is not yet emitting these
// events in production routes — outcome registers and computes sampleSize=0
// until wiring lands).
// =============================================================================

export const erDoorToProviderMinutesDefinition: OutcomeDefinition = {
  key: 'saudi.er.door_to_provider_minutes',
  name: 'ER Door-to-Provider Time (Saudi MoH)',
  description:
    'Median minutes from ER patient arrival to first provider contact. Saudi MoH target ≤ 30 min for non-critical presentations; CBAHI flags ≥ 45 min.',
  unit: 'minutes',
  direction: 'lower_is_better',
  target: 30,
  targetTolerance: 5,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'er.patient.arrived@v1',
    endEvent: 'er.provider.assigned@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'minutes',
  },
  tags: ['saudi', 'moh', 'cbahi', 'er', 'door-to-provider', 'emit-deferred'],
  status: 'active',
};

export function registerErDoorToProviderMinutes(): void {
  registerOutcome(erDoorToProviderMinutesDefinition);
}
