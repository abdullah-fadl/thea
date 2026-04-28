import { registerOutcome } from '../registry';
import type { OutcomeDefinition } from '../types';

// =============================================================================
// Example Outcome: ER Door-to-Provider Time (Phase 6.3)
//
// Measures the median elapsed time (minutes) from when an ER patient arrives
// to when a provider is assigned.  This is a widely-used ER quality metric.
//
// Clinical context:
//   The 2024 CMS guidelines recommend door-to-provider time ≤ 30 minutes
//   for non-critical presentations, with a tolerance of ±10 minutes.
//
// Future wiring:
//   The Phase 6.2 ER Triage Agent (see lib/agents/examples/er-triage-agent.ts
//   once implemented) would emit the two events this formula depends on:
//     - 'er.patient.arrived@v1'   → when a patient is registered in the ER
//     - 'er.provider.assigned@v1' → when a provider accepts the case
//   Until those agents are live, this outcome registers successfully but
//   computeOutcome() returns sampleSize = 0 (no events to pair).
//
// Direction: lower_is_better (faster = better outcome for the patient).
// Target: 30 minutes.  Tolerance: ±10 minutes.
// =============================================================================

export const erDoorToProviderDefinition: OutcomeDefinition = {
  key: 'er.door_to_provider_minutes',
  name: 'ER Door-to-Provider Time',
  description:
    'Median elapsed time in minutes from ER patient arrival to provider assignment. ' +
    'A proxy for ER responsiveness and triage efficiency.',
  unit: 'minutes',
  direction: 'lower_is_better',
  target: 30,
  targetTolerance: 10,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'er.patient.arrived@v1',
    endEvent: 'er.provider.assigned@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'minutes',
  },
  tags: ['er', 'triage', 'safety', 'cms-quality', 'door-to-provider'],
  status: 'active',
};

/**
 * Register the ER door-to-provider outcome at boot.
 * Called from lib/outcomes/index.ts when FF_OUTCOME_METRICS_ENABLED=true.
 */
export function registerErDoorToProvider(): void {
  registerOutcome(erDoorToProviderDefinition);
}
