// Phase 8.1.5 — NPHIES message Bundle profile validator.
//
// FHIR R4 + NPHIES rules enforced:
//   - type === 'message'                                              [required]
//   - timestamp present                                               [required]
//   - entry[] non-empty                                               [required]
//   - entry[0].resource.resourceType === 'MessageHeader'              [required, invariant]
//   - every entry has fullUrl (NPHIES message-mode requires fullUrls) [error per missing]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, requireValueIn, error } from '../validator';

export function validateBundle(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'Bundle';

  requireField(resource, 'type',      t, profile, out);
  requireValueIn(resource, 'type', ['message'] as const, t, profile, out);
  requireField(resource, 'timestamp', t, profile, out);
  requireField(resource, 'entry',     t, profile, out);

  const entries = (resource as { entry?: { fullUrl?: unknown; resource?: { resourceType?: string } }[] }).entry;
  if (Array.isArray(entries) && entries.length > 0) {
    const first = entries[0]?.resource;
    if (!first || first.resourceType !== 'MessageHeader') {
      out.push(
        error(
          `${t}.entry[0].resource`,
          'invariant',
          `NPHIES message Bundle.entry[0] must be a MessageHeader, got ${first?.resourceType ?? 'undefined'}`,
          profile,
        ),
      );
    }
    entries.forEach((e, i) => {
      if (!e.fullUrl || (typeof e.fullUrl === 'string' && e.fullUrl.length === 0)) {
        out.push(error(`${t}.entry[${i}].fullUrl`, 'required', 'Bundle.entry[*].fullUrl is required for message-mode bundles', profile));
      }
    });
  }

  return out;
}
