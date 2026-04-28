// Phase 5.4 — FHIR OperationOutcome error helpers
import type { FhirOperationOutcome } from './resources/types';

export function operationOutcomeError(
  severity: 'fatal' | 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string,
): FhirOperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  };
}

export function notFoundOutcome(resourceType: string, id: string): FhirOperationOutcome {
  return operationOutcomeError('error', 'not-found', `${resourceType}/${id} not found`);
}

export function featureDisabledOutcome(): FhirOperationOutcome {
  return operationOutcomeError(
    'error',
    'not-supported',
    'FHIR API is not enabled on this instance. Set THEA_FF_FHIR_API_ENABLED=true to enable.',
  );
}
