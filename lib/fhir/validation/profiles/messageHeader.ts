// Phase 8.1.5 — MessageHeader profile validator (NPHIES KSA).
//
// FHIR R4 + NPHIES rules enforced:
//   - eventCoding present (NPHIES routes on this)            [required]
//   - eventCoding.code present                                [required]
//   - destination[] non-empty                                 [required]
//   - destination[*].endpoint present                         [required]
//   - source.endpoint present                                 [required]
//   - focus[] non-empty (the message must point at something) [required]

import type { FhirResource } from '@/lib/fhir/types';
import { type ValidationIssue, requireField, error } from '../validator';

export function validateMessageHeader(resource: FhirResource, profile: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const t = 'MessageHeader';

  requireField(resource, 'eventCoding',      t, profile, out);
  requireField(resource, 'destination',      t, profile, out);
  requireField(resource, 'source',           t, profile, out);
  requireField(resource, 'focus',            t, profile, out);

  const r = resource as {
    eventCoding?: { code?: unknown };
    destination?: { endpoint?: unknown }[];
    source?:      { endpoint?: unknown };
  };

  if (r.eventCoding && (r.eventCoding.code === undefined || r.eventCoding.code === '')) {
    out.push(error(`${t}.eventCoding.code`, 'required', 'MessageHeader.eventCoding.code is required (NPHIES routes on it)', profile));
  }

  if (Array.isArray(r.destination)) {
    r.destination.forEach((d, i) => {
      if (!d || d.endpoint === undefined || d.endpoint === '') {
        out.push(error(`${t}.destination[${i}].endpoint`, 'required', 'MessageHeader.destination[*].endpoint is required', profile));
      }
    });
  }

  if (r.source && (r.source.endpoint === undefined || r.source.endpoint === '')) {
    out.push(error(`${t}.source.endpoint`, 'required', 'MessageHeader.source.endpoint is required', profile));
  }

  return out;
}
