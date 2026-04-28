/**
 * Anonymization Utilities for PDPL Right to Erasure
 *
 * Replaces PII with anonymized placeholders while preserving data structure
 * for medical record continuity.
 */

/** Fields containing personally identifiable information */
export const PII_FIELDS = [
  'firstName', 'lastName', 'fullName', 'middleName',
  'email', 'phone', 'mobile', 'homePhone', 'workPhone',
  'address', 'street', 'city', 'zipCode', 'postalCode',
  'nationalId', 'iqamaNumber', 'passportNo', 'passportNumber',
  'emergencyContactName', 'emergencyContactPhone',
  'nextOfKinName', 'nextOfKinPhone',
  'motherName', 'fatherName',
  'insuranceNumber', 'policyNumber',
] as const;

export type PiiField = (typeof PII_FIELDS)[number];

const REDACTED = '[REDACTED]';

/** Set of PII field names for O(1) lookup */
const PII_FIELD_SET: ReadonlySet<string> = new Set<string>(PII_FIELDS);

/**
 * Anonymize patient data fields for PDPL erasure compliance.
 * Replaces PII with "[REDACTED]" while preserving structural fields
 * needed for medical record continuity (id, mrn, tenantId).
 */
export function anonymizePatientRecord(
  patient: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patient)) {
    if (PII_FIELD_SET.has(key) && value !== null && value !== undefined) {
      result[key] = REDACTED;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Build a Prisma-compatible data object that sets all PII fields present
 * on the given record to "[REDACTED]".
 *
 * Only includes fields that actually exist on the record so Prisma
 * does not attempt to write to columns that don't exist.
 */
export function buildAnonymizationUpdate(
  existingRecord: Record<string, unknown>,
): Record<string, string> {
  const update: Record<string, string> = {};

  for (const field of PII_FIELDS) {
    if (field in existingRecord && existingRecord[field] !== null && existingRecord[field] !== undefined) {
      update[field] = REDACTED;
    }
  }

  return update;
}

// ---------------------------------------------------------------------------
// Free-text anonymization
// ---------------------------------------------------------------------------

/** Saudi national ID: 10 digits starting with 1 or 2 */
const NATIONAL_ID_REGEX = /\b[12]\d{9}\b/g;

/** Saudi mobile: +966 5x xxx xxxx or 05x xxx xxxx */
const SAUDI_PHONE_REGEX = /(?:\+966|00966|0)5\d[\s-]?\d{3}[\s-]?\d{4}/g;

/** General phone numbers (7+ digits, optionally with country code) */
const GENERAL_PHONE_REGEX = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

/** Email addresses */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Iqama number: 10 digits starting with 2 */
const IQAMA_REGEX = /\b2\d{9}\b/g;

/**
 * Replace known PII patterns (phone numbers, emails, national IDs)
 * in free-text fields.
 */
export function anonymizeText(text: string): string {
  let result = text;
  result = result.replace(EMAIL_REGEX, REDACTED);
  result = result.replace(SAUDI_PHONE_REGEX, REDACTED);
  result = result.replace(GENERAL_PHONE_REGEX, REDACTED);
  result = result.replace(NATIONAL_ID_REGEX, REDACTED);
  result = result.replace(IQAMA_REGEX, REDACTED);
  return result;
}
