import { CONSENT_TYPES } from './consentTypes';

/**
 * C3: Consent Enforcement
 *
 * Maps workflow transitions to required consent types.
 * Used at transition points (markReady, admission, procedure) to block if missing.
 */

export interface ConsentRequirement {
  consentTypeId: string;
  label: string;
  labelAr: string;
}

// Map of transition → required consent type IDs
export const CONSENT_REQUIREMENTS: Record<string, ConsentRequirement[]> = {
  // When marking patient ready for doctor
  MARK_READY: [
    { consentTypeId: 'general_treatment', label: 'General Treatment Consent', labelAr: 'موافقة على العلاج العام' },
    { consentTypeId: 'data_privacy', label: 'Data Privacy Consent', labelAr: 'موافقة على خصوصية البيانات' },
  ],
  // When admitting patient
  ADMISSION: [
    { consentTypeId: 'general_treatment', label: 'General Treatment Consent', labelAr: 'موافقة على العلاج العام' },
    { consentTypeId: 'data_privacy', label: 'Data Privacy Consent', labelAr: 'موافقة على خصوصية البيانات' },
    { consentTypeId: 'admission_consent', label: 'Admission Consent', labelAr: 'موافقة على التنويم' },
  ],
  // When starting a procedure
  PROCEDURE: [
    { consentTypeId: 'general_treatment', label: 'General Treatment Consent', labelAr: 'موافقة على العلاج العام' },
    { consentTypeId: 'procedure', label: 'Procedure Consent', labelAr: 'موافقة على الإجراء' },
  ],
  // When starting a surgical procedure
  SURGERY: [
    { consentTypeId: 'general_treatment', label: 'General Treatment Consent', labelAr: 'موافقة على العلاج العام' },
    { consentTypeId: 'surgical_consent', label: 'Surgical Consent', labelAr: 'موافقة على العملية الجراحية' },
  ],
};

export interface ConsentRecord {
  consentType: string;
  signedAt?: string;
  status?: string;
  withdrawnAt?: string;
  [key: string]: unknown;
}

/**
 * Check which consents are missing for a given transition.
 *
 * @param transition - The transition being attempted (e.g., 'MARK_READY', 'PROCEDURE')
 * @param existingConsents - Array of consent records already signed for the encounter
 * @returns Array of missing consent requirements (empty if all are met)
 */
export function getMissingConsents(
  transition: string,
  existingConsents: ConsentRecord[]
): ConsentRequirement[] {
  const requirements = CONSENT_REQUIREMENTS[transition];
  if (!requirements) return [];

  const activeConsents = existingConsents.filter((c) => c.status !== 'withdrawn');
  const signedTypes = new Set(activeConsents.map((c) => c.consentType));

  return requirements.filter((req) => !signedTypes.has(req.consentTypeId));
}

/**
 * Check if a refusal consent exists that replaces a standard consent requirement.
 * For example, a 'vitals_refusal' can satisfy the vitals requirement.
 */
export function hasRefusalConsent(
  consentTypeId: string,
  existingConsents: ConsentRecord[]
): boolean {
  const refusalMap: Record<string, string> = {
    procedure: 'procedure_refusal',
    general_treatment: 'treatment_refusal',
  };
  const refusalId = refusalMap[consentTypeId];
  if (!refusalId) return false;
  return existingConsents.some((c) => c.consentType === refusalId);
}

/**
 * Get withdrawn consents for a given encounter/set of consent records.
 *
 * @param existingConsents - Array of consent records for the encounter
 * @returns Array of consent records that have been withdrawn
 */
export function getWithdrawnConsents(
  existingConsents: ConsentRecord[]
): ConsentRecord[] {
  return existingConsents.filter((c) => c.status === 'withdrawn');
}

/**
 * Get missing consents considering refusal alternatives.
 */
export function getMissingConsentsWithRefusals(
  transition: string,
  existingConsents: ConsentRecord[]
): ConsentRequirement[] {
  const missing = getMissingConsents(transition, existingConsents);
  return missing.filter((req) => !hasRefusalConsent(req.consentTypeId, existingConsents));
}
