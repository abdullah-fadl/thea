import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Critical-lab alert response time (Phase 8.4)
//
// Median minutes from a critical-lab `clinical.alert@v1` (alertType
// `critical_lab`) to its corresponding `clinical.alert.acknowledged@v1`.
// CBAHI critical-value notification standards target acknowledgment within
// 30 minutes for high-acuity panels; 60 minutes is a hard escalation
// boundary. We headline 30 minutes with ±10 minutes tolerance.
//
// Source events:
//   - clinical.alert@v1                — emitted by Phase 8.3 LabResultMonitorAgent (LIVE)
//   - clinical.alert.acknowledged@v1   — Phase 8.4 SCAFFOLD; not yet emitted
//                                         (route wiring is a follow-up task,
//                                         see lib/events/schemas/clinical-alerts.ts)
//
// Status: emit-deferred end-event (the start event is live; until the
// acknowledgment route lands, computeOutcome returns sampleSize=0).
// =============================================================================

export const criticalLabAlertResponseTimeDefinition: OutcomeDefinition = {
  key: 'saudi.clinical.critical_lab_alert_response_minutes',
  name: 'Critical-Lab Alert Response Time (CBAHI)',
  description:
    'Median minutes from a critical-lab alert firing to a clinician acknowledging it. CBAHI critical-value notification target ≤ 30 min.',
  unit: 'minutes',
  direction: 'lower_is_better',
  target: 30,
  targetTolerance: 10,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'clinical.alert@v1',
    endEvent: 'clinical.alert.acknowledged@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'minutes',
  },
  tags: ['saudi', 'cbahi', 'clinical-alert', 'critical-lab', 'emit-deferred'],
  status: 'active',
};

export function registerCriticalLabAlertResponseTime(): void {
  registerOutcome(criticalLabAlertResponseTimeDefinition);
}
