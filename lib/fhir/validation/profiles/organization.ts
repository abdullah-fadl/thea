// Phase 8.1.5 — Organization profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - identifier[] non-empty (NPHIES KSA — payer/provider license id required)
//   - name present
//   - active is boolean if present (warning only)

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, warning } from '../validator';

export function validateOrganization(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Organization';

  requireField(resource, 'identifier', t, profile, out);
  requireField(resource, 'name',       t, profile, out);

  const active = (resource as { active?: unknown }).active;
  if (active !== undefined && typeof active !== 'boolean') {
    out.push(warning(`${t}.active`, 'cardinality', 'Organization.active should be boolean if present', profile));
  }

  return out;
}
