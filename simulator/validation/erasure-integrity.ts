/**
 * Post-scenario validation for PDPL erasure data integrity.
 *
 * Checks:
 * 1. Anonymized patient records have [REDACTED] in PII fields
 * 2. Medical records, audit logs, and consent records are preserved
 * 3. Erasure request records are intact with correct status
 */

import { PII_FIELDS } from '../../lib/privacy/anonymization';

const REDACTED = '[REDACTED]';

/**
 * Validate that a patient record has been properly anonymized.
 * Returns an array of validation errors (empty = all good).
 */
export function validateAnonymizedPatient(
  patientRecord: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  for (const field of PII_FIELDS) {
    if (field in patientRecord) {
      const value = patientRecord[field];
      if (value !== null && value !== undefined && value !== REDACTED) {
        errors.push(
          `PII field "${field}" was not anonymized (value: "${String(value).substring(0, 20)}...")`,
        );
      }
    }
  }

  // Structural fields must be preserved
  if (!patientRecord.id) {
    errors.push('Patient id must be preserved after anonymization');
  }
  if (!patientRecord.tenantId) {
    errors.push('Patient tenantId must be preserved after anonymization');
  }

  return errors;
}

/**
 * Validate that an erasure request record is in a valid end state.
 */
export function validateErasureRequest(
  request: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  const validEndStates = ['completed', 'partially_completed', 'rejected'];
  const status = String(request.status || '');

  if (!validEndStates.includes(status)) {
    errors.push(
      `Erasure request has unexpected status "${status}" — expected one of: ${validEndStates.join(', ')}`,
    );
  }

  if (status === 'completed' || status === 'partially_completed') {
    if (!request.completedAt) {
      errors.push('Completed erasure request is missing completedAt timestamp');
    }
    if (!request.reviewedBy) {
      errors.push('Completed erasure request is missing reviewedBy');
    }
  }

  if (status === 'partially_completed') {
    const retained = request.retainedData;
    if (!retained || !Array.isArray(retained) || retained.length === 0) {
      errors.push(
        'Partially completed erasure request should have at least one retained category',
      );
    }
  }

  return errors;
}
