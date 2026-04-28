// Phase 8.1.5 — Location profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status ∈ {active|suspended|inactive} if present     [value-set if present]
//   - name   present                                      [required]
//   - mode   ∈ {instance|kind} if present                 [value-set if present]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, requireValueIn } from '../validator';

const ALLOWED_STATUS = ['active', 'suspended', 'inactive'] as const;
const ALLOWED_MODE   = ['instance', 'kind'] as const;

export function validateLocation(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Location';

  requireField(resource, 'name', t, profile, out);
  // status / mode are optional in R4 — only check value if present.
  const r = resource as Record<string, unknown>;
  if (r.status !== undefined) requireValueIn(resource, 'status', ALLOWED_STATUS, t, profile, out);
  if (r.mode   !== undefined) requireValueIn(resource, 'mode',   ALLOWED_MODE,   t, profile, out);

  return out;
}
