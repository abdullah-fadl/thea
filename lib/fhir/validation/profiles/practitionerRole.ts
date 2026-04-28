// Phase 8.1.5 — PractitionerRole profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - practitioner present                           [required]
//   - organization present                           [required]
//   - code[] non-empty (NPHIES KSA — at least one role/specialty coding)

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField } from '../validator';

export function validatePractitionerRole(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'PractitionerRole';

  requireField(resource, 'practitioner', t, profile, out);
  requireField(resource, 'organization', t, profile, out);
  requireField(resource, 'code',         t, profile, out);

  return out;
}
