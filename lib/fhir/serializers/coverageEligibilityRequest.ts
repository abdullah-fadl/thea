// Phase 8.1.2 — FHIR R4 CoverageEligibilityRequest serializer (NPHIES eligibility)
// Sync pure function: NphiesEligibilityLog (Prisma) → FhirCoverageEligibilityRequest
//
// Discovery: NphiesEligibilityLog is the canonical FHIR
// CoverageEligibilityRequest source. Each row records a single eligibility
// check the platform performed against NPHIES — patientId, insuranceId
// (= PatientInsurance.id, i.e. the Coverage), createdBy (= the user who
// initiated the check, surfaced as `enterer`), and `createdAt` (= the
// `created` instant the request was issued). The matching response side
// lives on the same row (status/eligible/response Json) and is exposed by
// the sibling serializer `coverageEligibilityResponse.ts`. Same id is
// surfaced under both resourceType views — request and response are two
// projections of one log row.
//
// `insurer` is emitted as `Organization/${insuranceId}` as a placeholder
// reference, mirroring the 8.1.1 ClaimResponse approximation. The 8.1.5
// profile validator will tighten this by joining PatientInsurance → real
// insurerId. NPHIES adapters consuming this resource in 8.1.4 already
// route on `meta.profile`, not on `insurer`, so the placeholder is safe
// for downstream wire serialization.
import type { NphiesEligibilityLog } from '@prisma/client';
import type {
  FhirCoverageEligibilityRequest,
} from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

// Subset of the persisted response payload that informs the request side
// (service date is the only field cross-referenced from response → request).
interface PersistedEligibilityResponse {
  serviceDate?: string;
}

export function serializeCoverageEligibilityRequest(
  log: NphiesEligibilityLog,
  _tenantId: string,
): FhirCoverageEligibilityRequest {
  const persisted = (log.response ?? null) as PersistedEligibilityResponse | null;
  const servicedDate = persisted?.serviceDate
    ?? log.createdAt.toISOString().slice(0, 10);

  return {
    resourceType: 'CoverageEligibilityRequest',
    id: log.id,
    meta: {
      lastUpdated: log.createdAt.toISOString(),
      profile:     [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST],
    },
    status:  'active',
    purpose: ['benefits', 'validation'],
    patient: { reference: `Patient/${log.patientId}`, type: 'Patient' },
    servicedDate,
    created: log.createdAt.toISOString(),
    enterer: log.createdBy
      ? { reference: `Practitioner/${log.createdBy}`, type: 'Practitioner' }
      : undefined,
    insurer: { reference: `Organization/${log.insuranceId}`, type: 'Organization' },
    insurance: [{
      focal:    true,
      coverage: { reference: `Coverage/${log.insuranceId}`, type: 'Coverage' },
    }],
  };
}
