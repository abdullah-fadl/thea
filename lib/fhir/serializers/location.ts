// Phase 8.1.3 — FHIR R4 Location serializer (NPHIES supporting actor)
// Sync pure function: ClinicalInfraFacility → FhirLocation.
//
// Discovery: ClinicalInfraFacility is the canonical Location source —
// it carries name, shortCode (→ identifier + alias), type (→ category),
// status. Mode is fixed to "instance" because every facility row
// represents a real, addressable place, not a class of place.
//
// Stamps `meta.profile = [NPHIES_PROFILES.LOCATION]`.
import type { ClinicalInfraFacility } from '@prisma/client';
import type { FhirLocation, FhirIdentifier } from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const SHORT_CODE_SYSTEM = 'https://thea.com.sa/fhir/facility-short-code';
const LOCATION_TYPE_SYS = 'http://terminology.hl7.org/CodeSystem/v3-RoleCode';

const STATUS_MAP: Record<string, FhirLocation['status']> = {
  active:    'active',
  suspended: 'suspended',
  inactive:  'inactive',
};

export function serializeLocation(
  facility: ClinicalInfraFacility,
  _tenantId: string,
): FhirLocation {
  const identifier: FhirIdentifier[] = [];
  if (facility.shortCode) {
    identifier.push({ use: 'usual', system: SHORT_CODE_SYSTEM, value: facility.shortCode });
  }

  return {
    resourceType: 'Location',
    id: facility.id,
    meta: {
      lastUpdated: facility.updatedAt.toISOString(),
      profile:     [NPHIES_PROFILES.LOCATION],
    },
    identifier: identifier.length > 0 ? identifier : undefined,
    status: STATUS_MAP[facility.status] ?? 'active',
    name: facility.name,
    alias: facility.shortCode ? [facility.shortCode] : undefined,
    mode: 'instance',
    type: facility.type
      ? [{ coding: [{ system: LOCATION_TYPE_SYS, code: facility.type, display: facility.type }] }]
      : undefined,
  };
}
