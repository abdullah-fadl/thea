// Phase 8.1.5 — Practitioner profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - identifier[] non-empty (NPHIES KSA — at least one identifier per practitioner)
//   - name[] non-empty
//   - active is boolean if present (warning only — many providers omit it)

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, warning } from '../validator';

export function validatePractitioner(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Practitioner';

  requireField(resource, 'identifier', t, profile, out);
  requireField(resource, 'name',       t, profile, out);

  const active = (resource as { active?: unknown }).active;
  if (active !== undefined && typeof active !== 'boolean') {
    out.push(warning(`${t}.active`, 'cardinality', 'Practitioner.active should be boolean if present', profile));
  }

  return out;
}
