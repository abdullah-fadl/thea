// Phase 8.1.1 + 8.1.2 + 8.1.3 — NPHIES (Saudi National Platform for Health
// Information Exchange Services) FHIR R4 profile canonical URLs.
//
// These URLs identify the KSA-specific StructureDefinitions that NPHIES
// expects in `Resource.meta.profile`. We are NOT loading the profile
// definitions themselves yet — that's deferred to 8.1.5 (validator).
// Stamping the URLs now lets every serialized financial/eligibility/actor
// resource declare its intended NPHIES shape so future profile-validator
// runs catch shape drift, and downstream NPHIES adapters can route on
// profile.

export const NPHIES_PROFILES = {
  // Phase 8.1.1 — financial.
  COVERAGE:                      'http://nphies.sa/StructureDefinition/ksa-coverage',
  CLAIM:                         'http://nphies.sa/StructureDefinition/ksa-claim',
  CLAIM_RESPONSE:                'http://nphies.sa/StructureDefinition/ksa-claim-response',
  // Phase 8.1.2 — eligibility.
  COVERAGE_ELIGIBILITY_REQUEST:  'http://nphies.sa/StructureDefinition/ksa-coverage-eligibility-request',
  COVERAGE_ELIGIBILITY_RESPONSE: 'http://nphies.sa/StructureDefinition/ksa-coverage-eligibility-response',
  // Phase 8.1.3 — supporting actors.
  PRACTITIONER:                  'http://nphies.sa/StructureDefinition/ksa-practitioner',
  PRACTITIONER_ROLE:             'http://nphies.sa/StructureDefinition/ksa-practitioner-role',
  ORGANIZATION:                  'http://nphies.sa/StructureDefinition/ksa-organization',
  LOCATION:                      'http://nphies.sa/StructureDefinition/ksa-location',
  // Phase 8.1.3 — envelope (NPHIES message-mode wire format).
  MESSAGE_BUNDLE:                'http://nphies.sa/StructureDefinition/ksa-message-bundle',
  MESSAGE_HEADER:                'http://nphies.sa/StructureDefinition/ksa-message-header',
} as const;

export type NphiesProfile = typeof NPHIES_PROFILES[keyof typeof NPHIES_PROFILES];

// NPHIES extension namespace for KSA-specific data points (e.g. Saudi-ID
// linkage, payer license). Used in `Resource.extension[*].url`.
export const NPHIES_EXTENSION_BASE = 'http://nphies.sa/StructureDefinition' as const;
