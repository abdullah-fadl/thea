// Phase 8.1.5 — CoverageEligibilityRequest profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status  ∈ {active|cancelled|draft|entered-in-error}     [required]
//   - purpose[] non-empty, each ∈ {auth-requirements|benefits|discovery|validation}
//   - patient present                                         [required]
//   - created present                                         [required]
//   - insurer present                                         [required]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, requireValueIn, error } from '../validator';

const ALLOWED_STATUS  = ['active', 'cancelled', 'draft', 'entered-in-error'] as const;
const ALLOWED_PURPOSE = ['auth-requirements', 'benefits', 'discovery', 'validation'] as const;

export function validateCoverageEligibilityRequest(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'CoverageEligibilityRequest';

  requireField(resource,   'status',  t, profile, out);
  requireValueIn(resource, 'status',  ALLOWED_STATUS, t, profile, out);
  requireField(resource,   'purpose', t, profile, out);
  requireField(resource,   'patient', t, profile, out);
  requireField(resource,   'created', t, profile, out);
  requireField(resource,   'insurer', t, profile, out);

  const purpose = (resource as { purpose?: unknown[] }).purpose;
  if (Array.isArray(purpose)) {
    purpose.forEach((p, i) => {
      if (typeof p !== 'string' || !(ALLOWED_PURPOSE as readonly string[]).includes(p)) {
        out.push(error(`${t}.purpose[${i}]`, 'value-set', `purpose='${String(p)}' is not in [${ALLOWED_PURPOSE.join(', ')}]`, profile));
      }
    });
  }

  return out;
}
