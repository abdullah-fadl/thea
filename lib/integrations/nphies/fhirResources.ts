// =============================================================================
// Shared FHIR Resource Builders for NPHIES
// =============================================================================

import type { NphiesPatient, NphiesCoverage, DenialReason } from './types';
import { NPHIES_PROFILES, NPHIES_SYSTEMS, NPHIES_DENIAL_REASONS } from './types';

/**
 * Creates a FHIR Patient resource for NPHIES.
 */
export function createPatientResource(id: string, patient: NphiesPatient): object {
  return {
    resourceType: 'Patient',
    id,
    meta: { profile: [NPHIES_PROFILES.PATIENT] },
    identifier: [
      {
        type: {
          coding: [
            {
              system: NPHIES_SYSTEMS.IDENTIFIER_TYPE,
              code: patient.nationalId.startsWith('1') ? 'NI' : 'PRC',
            },
          ],
        },
        system: patient.nationalId.startsWith('1')
          ? NPHIES_SYSTEMS.NATIONAL_ID
          : NPHIES_SYSTEMS.IQAMA,
        value: patient.nationalId,
      },
    ],
    name: [
      {
        use: 'official',
        text: patient.fullName,
        family: patient.fullName.split(' ').pop(),
        given: patient.fullName.split(' ').slice(0, -1),
      },
    ],
    gender: patient.gender,
    birthDate: patient.birthDate,
    telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : undefined,
  };
}

/**
 * Creates a FHIR Coverage resource for NPHIES.
 */
export function createCoverageResource(
  id: string,
  patientId: string,
  coverage: NphiesCoverage,
): object {
  return {
    resourceType: 'Coverage',
    id,
    meta: { profile: [NPHIES_PROFILES.COVERAGE] },
    status: 'active',
    type: {
      coding: [
        {
          system: NPHIES_SYSTEMS.COVERAGE_TYPE,
          code: 'EHCPOL',
          display: 'Extended healthcare',
        },
      ],
    },
    subscriber: { reference: `Patient/${patientId}` },
    beneficiary: { reference: `Patient/${patientId}` },
    relationship: {
      coding: [
        {
          system: NPHIES_SYSTEMS.SUBSCRIBER_RELATIONSHIP,
          code: coverage.relationToSubscriber,
        },
      ],
    },
    period: {
      start: coverage.startDate,
      end: coverage.endDate,
    },
    payor: [
      {
        type: 'Organization',
        identifier: {
          system: NPHIES_SYSTEMS.PAYER_LICENSE,
          value: coverage.insurerId,
        },
        display: coverage.insurerName,
      },
    ],
    identifier: [
      {
        system: NPHIES_SYSTEMS.MEMBER_ID,
        value: coverage.memberId,
      },
    ],
    subscriberId: coverage.subscriberId || coverage.memberId,
  };
}

/**
 * Parses a denial reason code from a NPHIES response into a structured DenialReason.
 * Falls back to the raw code/display if no mapping found.
 */
export function parseDenialReason(
  code?: string,
  display?: string,
): DenialReason | undefined {
  if (!code && !display) return undefined;

  const mapped = code ? NPHIES_DENIAL_REASONS[code] : undefined;
  if (mapped) {
    return {
      code: code!,
      display: mapped.en,
      displayAr: mapped.ar,
      details: display,
    };
  }

  return {
    code: code || 'UNKNOWN',
    display: display || code || 'Unknown denial reason',
    displayAr: display || code || 'سبب رفض غير معروف',
  };
}

/**
 * Extracts denial reasons from a ClaimResponse resource.
 */
export function extractDenialReasons(claimResponse: any): DenialReason[] {
  const reasons: DenialReason[] = [];

  // From top-level error array
  const errors = claimResponse?.error;
  if (Array.isArray(errors)) {
    for (const err of errors) {
      const coding = err?.code?.coding?.[0];
      const reason = parseDenialReason(coding?.code, coding?.display);
      if (reason) reasons.push(reason);
    }
  }

  // From item-level adjudication reasons
  const items = claimResponse?.item;
  if (Array.isArray(items)) {
    for (const item of items) {
      const adjudications = item?.adjudication;
      if (!Array.isArray(adjudications)) continue;
      for (const adj of adjudications) {
        const reasonCoding = adj?.reason?.coding?.[0];
        if (reasonCoding) {
          const reason = parseDenialReason(reasonCoding.code, reasonCoding.display);
          if (reason) reasons.push(reason);
        }
      }
    }
  }

  return reasons;
}

/**
 * Maps NPHIES encounter type to FHIR ActCode.
 */
export function mapEncounterType(type: 'outpatient' | 'inpatient' | 'emergency'): string {
  switch (type) {
    case 'outpatient': return 'AMB';
    case 'inpatient': return 'IMP';
    case 'emergency': return 'EMER';
    default: return 'AMB';
  }
}
