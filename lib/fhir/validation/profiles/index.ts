// Phase 8.1.5 — NPHIES profile validator registry.
//
// Maps NPHIES KSA profile URLs → per-profile validator functions. Each
// validator returns a `ValidationIssue[]`; callers wrap with `isValid` to
// derive the top-level `valid` boolean. Profiles cover the 11 resources
// Thea ships in 8.1.1–8.1.3.

import type { FhirResource } from '@/lib/fhir/types';
import type { ValidationIssue } from '../validator';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';

import { validateCoverage }                      from './coverage';
import { validateClaim }                          from './claim';
import { validateClaimResponse }                  from './claimResponse';
import { validateCoverageEligibilityRequest }     from './coverageEligibilityRequest';
import { validateCoverageEligibilityResponse }    from './coverageEligibilityResponse';
import { validatePractitioner }                   from './practitioner';
import { validatePractitionerRole }               from './practitionerRole';
import { validateOrganization }                   from './organization';
import { validateLocation }                       from './location';
import { validateMessageHeader }                  from './messageHeader';
import { validateBundle as validateMessageBundle } from './bundle';

export type ProfileValidator = (resource: FhirResource, profile: string) => ValidationIssue[];

const REGISTRY: Record<string, ProfileValidator> = {
  [NPHIES_PROFILES.COVERAGE]:                      validateCoverage,
  [NPHIES_PROFILES.CLAIM]:                         validateClaim,
  [NPHIES_PROFILES.CLAIM_RESPONSE]:                validateClaimResponse,
  [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST]:  validateCoverageEligibilityRequest,
  [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE]: validateCoverageEligibilityResponse,
  [NPHIES_PROFILES.PRACTITIONER]:                  validatePractitioner,
  [NPHIES_PROFILES.PRACTITIONER_ROLE]:             validatePractitionerRole,
  [NPHIES_PROFILES.ORGANIZATION]:                  validateOrganization,
  [NPHIES_PROFILES.LOCATION]:                      validateLocation,
  [NPHIES_PROFILES.MESSAGE_HEADER]:                validateMessageHeader,
  [NPHIES_PROFILES.MESSAGE_BUNDLE]:                validateMessageBundle,
};

export function getProfileValidator(profileUrl: string): ProfileValidator | null {
  return REGISTRY[profileUrl] ?? null;
}

/** Snapshot of registered profile URLs (for diagnostics + tests). */
export function listRegisteredProfiles(): string[] {
  return Object.keys(REGISTRY);
}
