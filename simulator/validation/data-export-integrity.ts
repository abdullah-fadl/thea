/**
 * Data Export Integrity Validation
 *
 * Post-scenario checks for PDPL patient data export:
 * - Export payload contains all required sections
 * - No internal IDs leaked (tenantId, internal UUIDs)
 * - Metadata is correct
 */

export interface DataExportPayload {
  exportDate: string;
  dataSubject: { name: string; mrn?: string };
  sections: Record<string, unknown>;
  metadata: { pdplVersion: string; exportFormat: string; generatedBy: string };
}

/** Fields that must NOT appear in exported data */
const FORBIDDEN_FIELDS = [
  'tenantId',
  'createdBy',
  'updatedBy',
  'createdByUserId',
  'recordedByUserId',
  'authoredBy',
  'orderedBy',
  'attendingPhysicianId',
  'signatureData',
];

const REQUIRED_SECTIONS = [
  'demographics',
  'encounters',
  'orders',
  'clinicalNotes',
  'consents',
  'opdVisits',
];

/**
 * Recursively checks if any forbidden field appears in the given object.
 * Returns a list of violations (field paths).
 */
function findForbiddenFields(
  obj: unknown,
  path: string = '',
): string[] {
  const violations: string[] = [];

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return violations;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      violations.push(...findForbiddenFields(item, `${path}[${i}]`));
    });
    return violations;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_FIELDS.includes(key)) {
      violations.push(fieldPath);
    }

    if (typeof value === 'object' && value !== null) {
      violations.push(...findForbiddenFields(value, fieldPath));
    }
  }

  return violations;
}

/**
 * Validate a data export payload for PDPL compliance.
 * Returns an array of error messages (empty = valid).
 */
export function validateDataExport(payload: DataExportPayload): string[] {
  const errors: string[] = [];

  // 1. Check top-level structure
  if (!payload.exportDate) errors.push('Missing exportDate');
  if (!payload.dataSubject) errors.push('Missing dataSubject');
  if (!payload.sections) errors.push('Missing sections');
  if (!payload.metadata) errors.push('Missing metadata');

  // 2. Check metadata
  if (payload.metadata) {
    if (payload.metadata.pdplVersion !== '1.0') {
      errors.push(`Invalid pdplVersion: ${payload.metadata.pdplVersion}`);
    }
    if (payload.metadata.exportFormat !== 'JSON') {
      errors.push(`Invalid exportFormat: ${payload.metadata.exportFormat}`);
    }
    if (!payload.metadata.generatedBy?.includes('Thea EHR')) {
      errors.push(`Invalid generatedBy: ${payload.metadata.generatedBy}`);
    }
  }

  // 3. Check required sections exist
  if (payload.sections) {
    for (const section of REQUIRED_SECTIONS) {
      if (!(section in payload.sections)) {
        errors.push(`Missing section: ${section}`);
      }
    }
  }

  // 4. Check no internal fields leaked
  if (payload.sections) {
    const violations = findForbiddenFields(payload.sections, 'sections');
    for (const v of violations) {
      errors.push(`Internal field leaked: ${v}`);
    }
  }

  // 5. Validate exportDate is a valid ISO string
  if (payload.exportDate) {
    const date = new Date(payload.exportDate);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid exportDate: ${payload.exportDate}`);
    }
  }

  return errors;
}
