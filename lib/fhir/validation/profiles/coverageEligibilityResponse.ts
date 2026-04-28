// Phase 8.1.5 — CoverageEligibilityResponse profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status   ∈ {active|cancelled|draft|entered-in-error}    [required]
//   - purpose[] non-empty                                     [required]
//   - patient  present                                        [required]
//   - created  present                                        [required]
//   - request  present (back-reference to the original request) [required]
//   - outcome  ∈ {queued|complete|error|partial}              [required]
//   - insurer  present                                        [required]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, requireValueIn } from '../validator';

const ALLOWED_STATUS  = ['active', 'cancelled', 'draft', 'entered-in-error'] as const;
const ALLOWED_OUTCOME = ['queued', 'complete', 'error', 'partial'] as const;

export function validateCoverageEligibilityResponse(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'CoverageEligibilityResponse';

  requireField(resource,   'status',  t, profile, out);
  requireValueIn(resource, 'status',  ALLOWED_STATUS, t, profile, out);
  requireField(resource,   'purpose', t, profile, out);
  requireField(resource,   'patient', t, profile, out);
  requireField(resource,   'created', t, profile, out);
  requireField(resource,   'request', t, profile, out);
  requireField(resource,   'outcome', t, profile, out);
  requireValueIn(resource, 'outcome', ALLOWED_OUTCOME, t, profile, out);
  requireField(resource,   'insurer', t, profile, out);

  return out;
}
