/**
 * Phase 8.3 — Clinical alert event schema
 *
 * Single high-value event emitted by the LabResultMonitorAgent (and any
 * future clinical-alert agents) when a rule matches against patient data.
 *
 * PHI discipline mirrors thea-health.ts: payloads carry only opaque IDs,
 * tenant scope, alert metadata (type/severity/rule), and the subject
 * pointer (subjectType + subjectId). Subscribers re-read the underlying
 * row by ID through tenant-scoped queries — clinical values, names, and
 * narratives never travel on the bus.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

registerEventType({
  eventName: 'clinical.alert',
  version: 1,
  aggregate: 'clinical_alert',
  description:
    'A clinical decision-support agent flagged a subject (lab result, prescription, etc.). Suggestion only — never auto-applies; downstream consumers display to a clinician.',
  payloadSchema: z.object({
    tenantId: z.string().uuid(),
    alertType: z.enum([
      'critical_lab',
      'medication_interaction',
      'allergy_match',
      'overdue_followup',
    ]),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    rule: z.string().min(1),
    subjectType: z.enum([
      'patient',
      'encounter',
      'lab_result',
      'prescription',
    ]),
    subjectId: z.string().uuid(),
    hospitalId: z.string().uuid().optional(),
  }),
});

// ─── clinical.alert.acknowledged@v1 (Phase 8.4 — scaffold, not yet emitted) ──
// Fired when a clinician acknowledges a clinical.alert@v1 in the UI. The
// schema is registered now so Phase 8.4 outcome formulas can reference it
// (and emit-time validation will work the moment a UI route starts emitting),
// but no route currently produces this event. The Saudi
// `critical-lab-alert-response-time` outcome pairs clinical.alert@v1 (start)
// with this event (end) once wiring lands — see NOTES.md §Phase 8.4.
registerEventType({
  eventName: 'clinical.alert.acknowledged',
  version: 1,
  aggregate: 'clinical_alert',
  description:
    'A clinician acknowledged a previously raised clinical alert (suggestion-only — acknowledgment closes the loop on response-time outcomes).',
  payloadSchema: z.object({
    tenantId: z.string().uuid(),
    alertEventId: z.string().uuid(),
    alertType: z.enum([
      'critical_lab',
      'medication_interaction',
      'allergy_match',
      'overdue_followup',
    ]),
    subjectType: z.enum([
      'patient',
      'encounter',
      'lab_result',
      'prescription',
    ]),
    subjectId: z.string().uuid(),
    acknowledgedBy: z.string().uuid(),
    acknowledgedAt: z.string().datetime(),
  }),
});
