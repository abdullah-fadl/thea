// Phase 8.1.3 — FHIR R4 Practitioner serializer (NPHIES supporting actor)
// Sync pure function: ClinicalInfraProvider (+ optional ClinicalInfraProviderProfile)
// → FhirPractitioner.
//
// Discovery: ClinicalInfraProvider is the canonical Practitioner source.
// It carries displayName, email, staffId, employmentType, shortCode,
// specialtyCode, isArchived. The optional ClinicalInfraProviderProfile
// row (1:1 keyed by providerId) carries licenseNumber + level →
// projected as Practitioner.qualification[].
//
// Stamps `meta.profile = [NPHIES_PROFILES.PRACTITIONER]` so future
// profile validators can shape-check.
import type {
  ClinicalInfraProvider,
  ClinicalInfraProviderProfile,
} from '@prisma/client';
import type {
  FhirPractitioner,
  FhirHumanName,
  FhirContactPoint,
  FhirIdentifier,
} from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const STAFF_ID_SYSTEM   = 'https://thea.com.sa/fhir/practitioner-staff-id';
const SHORT_CODE_SYSTEM = 'https://thea.com.sa/fhir/practitioner-short-code';
const LICENSE_SYSTEM    = 'http://nphies.sa/identifier/practitioner-license';
const QUAL_SYSTEM       = 'http://nphies.sa/terminology/CodeSystem/practitioner-level';

function splitName(displayName: string): FhirHumanName {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { use: 'official', text: displayName, family: parts[0] };
  const family = parts[parts.length - 1];
  const given  = parts.slice(0, -1);
  return { use: 'official', text: displayName, family, given };
}

export function serializePractitioner(
  provider: ClinicalInfraProvider,
  profile: ClinicalInfraProviderProfile | null,
  _tenantId: string,
): FhirPractitioner {
  const identifier: FhirIdentifier[] = [];
  if (provider.staffId) {
    identifier.push({ use: 'official', system: STAFF_ID_SYSTEM, value: provider.staffId });
  }
  if (provider.shortCode) {
    identifier.push({ use: 'usual', system: SHORT_CODE_SYSTEM, value: provider.shortCode });
  }
  if (profile?.licenseNumber) {
    identifier.push({ use: 'official', system: LICENSE_SYSTEM, value: profile.licenseNumber });
  }

  const telecom: FhirContactPoint[] = [];
  if (provider.email) {
    telecom.push({ system: 'email', value: provider.email, use: 'work' });
  }

  const qualification: NonNullable<FhirPractitioner['qualification']> = [];
  if (profile?.level) {
    qualification.push({
      code: { coding: [{ system: QUAL_SYSTEM, code: profile.level, display: profile.level }] },
      identifier: profile.licenseNumber
        ? [{ system: LICENSE_SYSTEM, value: profile.licenseNumber }]
        : undefined,
    });
  }

  return {
    resourceType: 'Practitioner',
    id: provider.id,
    meta: {
      lastUpdated: provider.updatedAt.toISOString(),
      profile:     [NPHIES_PROFILES.PRACTITIONER],
    },
    identifier: identifier.length > 0 ? identifier : undefined,
    active: !provider.isArchived,
    name: [splitName(provider.displayName)],
    telecom: telecom.length > 0 ? telecom : undefined,
    qualification: qualification.length > 0 ? qualification : undefined,
  };
}
