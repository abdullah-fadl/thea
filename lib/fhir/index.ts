/**
 * FHIR R4 Module — Barrel Exports
 *
 * Entry point for all FHIR R4 functionality including
 * the server core, mappers, search, and NPHIES integration.
 */

// Core FHIR server operations
export {
  buildCapabilityStatement,
  fhirRead,
  fhirSearch,
  fhirCreate,
  fhirUpdate,
  fhirEverything,
  operationOutcome,
} from './server';

// Mappers: Thea → FHIR
export {
  toFhirPatient,
  toFhirEncounter,
  toFhirObservation,
  toFhirDiagnosticReport,
  toFhirImagingStudy,
  toFhirMedicationRequest,
  toFhirCondition,
  toFhirAllergyIntolerance,
  toFhirServiceRequest,
  toFhirCoverage,
  toFhirProcedure,
  toFhirPractitioner,
  buildSearchBundle,
  buildEntry,
} from './mappers/toFhir';

// Mappers: FHIR → Thea
export {
  fromFhirPatient,
  fromFhirEncounter,
  fromFhirObservation,
  fromFhirServiceRequest,
  fromFhirCondition,
  fromFhirAllergyIntolerance,
  fromFhirMedicationRequest,
  fromFhirCoverage,
} from './mappers/fromFhir';

// Search
export { parseFhirSearchParams, getSupportedSearchParams } from './search/searchParams';
export { buildFhirQuery } from './search/queryBuilder';

// Types
export type {
  FhirResource,
  FhirBundle,
  FhirOperationOutcome,
  FhirCapabilityStatement,
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  FhirDiagnosticReport,
  FhirImagingStudy,
  FhirMedicationRequest,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirServiceRequest,
  FhirCoverage,
  FhirProcedure,
  FhirPractitioner,
  FhirOrganization,
  FhirSubscription,
} from './resources/types';
