// Phase 8.1.5 — Claim profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - status   ∈ {active|cancelled|draft|entered-in-error}      [required]
//   - use      ∈ {claim|preauthorization|predetermination}      [required]
//   - type     present                                          [required]
//   - patient  present                                          [required]
//   - created  present (ISO8601 dateTime)                       [required]
//   - provider present                                          [required]
//   - priority present                                          [required]
//   - insurance[] non-empty                                     [required]
//   - insurance[*].coverage present                             [required, item-level]
//   - insurance[*].sequence is a number                         [error if otherwise]
//   - insurance has exactly one focal=true entry                [warning otherwise]

import type { FhirResource } from '@/lib/fhir/types';
import {
  type ValidationIssue,
  requireField,
  requireValueIn,
  error,
  warning,
} from '../validator';

const ALLOWED_STATUS = ['active', 'cancelled', 'draft', 'entered-in-error'] as const;
const ALLOWED_USE    = ['claim', 'preauthorization', 'predetermination'] as const;

export function validateClaim(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Claim';

  requireField(resource,   'status',   t, profile, out);
  requireValueIn(resource, 'status',   ALLOWED_STATUS, t, profile, out);
  requireField(resource,   'use',      t, profile, out);
  requireValueIn(resource, 'use',      ALLOWED_USE, t, profile, out);
  requireField(resource,   'type',     t, profile, out);
  requireField(resource,   'patient',  t, profile, out);
  requireField(resource,   'created',  t, profile, out);
  requireField(resource,   'provider', t, profile, out);
  requireField(resource,   'priority', t, profile, out);
  requireField(resource,   'insurance',t, profile, out);

  const insurance = (resource as { insurance?: unknown[] }).insurance;
  if (Array.isArray(insurance)) {
    let focalCount = 0;
    insurance.forEach((entry, i) => {
      const e = entry as { sequence?: unknown; focal?: unknown; coverage?: unknown };
      if (e.coverage === undefined || e.coverage === null) {
        out.push(error(`${t}.insurance[${i}].coverage`, 'required', 'Claim.insurance[*].coverage is required', profile));
      }
      if (typeof e.sequence !== 'number') {
        out.push(error(`${t}.insurance[${i}].sequence`, 'cardinality', 'Claim.insurance[*].sequence must be an integer', profile));
      }
      if (e.focal === true) focalCount++;
    });
    if (insurance.length > 0 && focalCount !== 1) {
      out.push(warning(`${t}.insurance`, 'invariant', `expected exactly one focal=true insurance entry, got ${focalCount}`, profile));
    }
  }

  return out;
}
