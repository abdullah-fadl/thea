// Phase 8.1.5 — Coverage profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status ∈ {active|cancelled|draft|entered-in-error}      [required]
//   - beneficiary present (FhirReference)                      [required]
//   - payor[] non-empty                                        [required]
//   - subscriberId present (NPHIES KSA — payer member id)      [warning if missing]
//   - period present (NPHIES KSA — coverage window)            [warning if missing]

import type { FhirResource } from '@/lib/fhir/types';
import {
  type ValidationIssue,
  requireField,
  requireValueIn,
  warning,
} from '../validator';

const ALLOWED_STATUS = ['active', 'cancelled', 'draft', 'entered-in-error'] as const;

export function validateCoverage(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Coverage';

  requireField(resource, 'status',      t, profile, out);
  requireValueIn(resource, 'status', ALLOWED_STATUS, t, profile, out);
  requireField(resource, 'beneficiary', t, profile, out);
  requireField(resource, 'payor',       t, profile, out);

  // NPHIES KSA strongly recommends these — surface as warnings.
  const r = resource as Record<string, unknown>;
  if (r.subscriberId === undefined || r.subscriberId === '') {
    out.push(warning(`${t}.subscriberId`, 'recommended', 'NPHIES KSA recommends Coverage.subscriberId (payer member id)', profile));
  }
  if (r.period === undefined || r.period === null) {
    out.push(warning(`${t}.period`, 'recommended', 'NPHIES KSA recommends Coverage.period (active window)', profile));
  }

  return out;
}
