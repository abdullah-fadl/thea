// Phase 8.1.5 — ClaimResponse profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status   ∈ {active|cancelled|draft|entered-in-error}    [required]
//   - use      ∈ {claim|preauthorization|predetermination}    [required]
//   - type     present                                        [required]
//   - patient  present                                        [required]
//   - created  present                                        [required]
//   - insurer  present                                        [required]
//   - outcome  ∈ {queued|complete|error|partial}              [required]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, requireValueIn } from '../validator';

const ALLOWED_STATUS  = ['active', 'cancelled', 'draft', 'entered-in-error'] as const;
const ALLOWED_USE     = ['claim', 'preauthorization', 'predetermination'] as const;
const ALLOWED_OUTCOME = ['queued', 'complete', 'error', 'partial'] as const;

export function validateClaimResponse(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'ClaimResponse';

  requireField(resource,   'status',  t, profile, out);
  requireValueIn(resource, 'status',  ALLOWED_STATUS, t, profile, out);
  requireField(resource,   'use',     t, profile, out);
  requireValueIn(resource, 'use',     ALLOWED_USE, t, profile, out);
  requireField(resource,   'type',    t, profile, out);
  requireField(resource,   'patient', t, profile, out);
  requireField(resource,   'created', t, profile, out);
  requireField(resource,   'insurer', t, profile, out);
  requireField(resource,   'outcome', t, profile, out);
  requireValueIn(resource, 'outcome', ALLOWED_OUTCOME, t, profile, out);

  return out;
}
