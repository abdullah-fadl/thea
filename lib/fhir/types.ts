// Phase 5.4 + Phase 7.7 + Phase 8.1.1 + Phase 8.1.2 + Phase 8.1.3 — FHIR R4 read-only subset types
// Convenience barrel for the read-only serializers + routes.
// Full type library: lib/fhir/resources/types.ts

export type {
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  // Phase 7.7 — additional R4 resources for the read-only API.
  FhirMedicationRequest,
  FhirAllergyIntolerance,
  FhirCondition,
  // Phase 8.1.1 — NPHIES financial resources (read-only foundation).
  FhirCoverage,
  FhirClaim,
  FhirClaimResponse,
  // Phase 8.1.2 — NPHIES eligibility resources (read-only).
  FhirCoverageEligibilityRequest,
  FhirCoverageEligibilityResponse,
  // Phase 8.1.3 — NPHIES supporting actors + envelope.
  FhirPractitioner,
  FhirPractitionerRole,
  FhirOrganization,
  FhirLocation,
  FhirMessageHeader,
  FhirResource,
  FhirAddress,
  // Bundle / Outcome / shared primitives.
  FhirBundle,
  FhirBundleEntry,
  FhirOperationOutcome,
  FhirMeta,
  FhirReference,
  FhirCodeableConcept,
  FhirCoding,
  FhirHumanName,
  FhirContactPoint,
  FhirIdentifier,
  FhirAnnotation,
  FhirQuantity,
  FhirPeriod,
  FhirMoney,
} from './resources/types';
