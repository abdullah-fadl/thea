// Phase 8.1.3 — FHIR R4 PractitionerRole serializer (NPHIES supporting actor)
// Sync pure function: ClinicalInfraProviderAssignment (+ optional provider
// for specialty/role enrichment) → FhirPractitionerRole.
//
// Discovery: ClinicalInfraProviderAssignment is the canonical
// PractitionerRole source. It pins a provider to a primary clinic plus
// optional parallel clinics. The provider row contributes specialtyCode +
// employmentType (→ role code). Each clinicId becomes a Location reference;
// the primary clinic also becomes the organization reference (NPHIES treats
// the clinic as the practising organization).
//
// Stamps `meta.profile = [NPHIES_PROFILES.PRACTITIONER_ROLE]`.
import type {
  ClinicalInfraProviderAssignment,
  ClinicalInfraProvider,
} from '@prisma/client';
import type {
  FhirPractitionerRole,
  FhirCodeableConcept,
  FhirReference,
} from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const ROLE_SYSTEM      = 'http://nphies.sa/terminology/CodeSystem/practitioner-role';
const SPECIALTY_SYSTEM = 'http://nphies.sa/terminology/CodeSystem/practitioner-specialty';

function specialtyConcept(code: string): FhirCodeableConcept {
  return { coding: [{ system: SPECIALTY_SYSTEM, code, display: code }] };
}

function roleConcept(code: string, display: string): FhirCodeableConcept {
  return { coding: [{ system: ROLE_SYSTEM, code, display }] };
}

export function serializePractitionerRole(
  assignment: ClinicalInfraProviderAssignment,
  provider: ClinicalInfraProvider | null,
  _tenantId: string,
): FhirPractitionerRole {
  const code: FhirCodeableConcept[] = [];
  if (provider?.employmentType) {
    code.push(roleConcept(provider.employmentType, provider.employmentType));
  }

  const specialty: FhirCodeableConcept[] = [];
  if (provider?.specialtyCode) {
    specialty.push(specialtyConcept(provider.specialtyCode));
  }

  const allClinicIds = [
    ...(assignment.primaryClinicId ? [assignment.primaryClinicId] : []),
    ...(assignment.parallelClinicIds ?? []),
  ];
  const location: FhirReference[] = allClinicIds.map(cid => ({
    reference: `Location/${cid}`,
    type:      'Location',
  }));

  return {
    resourceType: 'PractitionerRole',
    id: assignment.id,
    meta: {
      lastUpdated: assignment.updatedAt.toISOString(),
      profile:     [NPHIES_PROFILES.PRACTITIONER_ROLE],
    },
    active: provider ? !provider.isArchived : undefined,
    practitioner: { reference: `Practitioner/${assignment.providerId}`, type: 'Practitioner' },
    organization: assignment.primaryClinicId
      ? { reference: `Organization/${assignment.primaryClinicId}`, type: 'Organization' }
      : undefined,
    code:      code.length > 0      ? code      : undefined,
    specialty: specialty.length > 0 ? specialty : undefined,
    location:  location.length > 0  ? location  : undefined,
  };
}
