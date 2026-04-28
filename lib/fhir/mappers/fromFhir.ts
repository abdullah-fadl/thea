/**
 * FHIR R4 → Thea Data Mappers
 *
 * Converts incoming FHIR R4 resources to internal Thea data structures.
 * Used when external systems POST/PUT FHIR resources to Thea.
 */

import type {
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  FhirServiceRequest,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirMedicationRequest,
  FhirCoverage,
} from '../resources/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a FHIR string field: trim, limit length, strip control chars */
function sanitize(value: string | undefined | null, maxLen = 200): string {
  if (!value) return '';
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, maxLen);
}

function findIdentifier(identifiers: FhirPatient['identifier'], system: string): string | undefined {
  const raw = identifiers?.find((i) => i.system === system)?.value;
  return raw ? sanitize(raw, 100) : undefined;
}

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export function fromFhirPatient(fhir: FhirPatient): Record<string, unknown> {
  const name = fhir.name?.[0];
  const phone = fhir.telecom?.find((t) => t.system === 'phone');
  const email = fhir.telecom?.find((t) => t.system === 'email');

  const genderMap: Record<string, string> = {
    male: 'MALE', female: 'FEMALE', other: 'OTHER', unknown: 'UNKNOWN',
  };

  return {
    mrn: findIdentifier(fhir.identifier, 'https://thea.com.sa/fhir/mrn'),
    nationalId: findIdentifier(fhir.identifier, 'https://nphies.sa/identifier/nid'),
    iqama: findIdentifier(fhir.identifier, 'https://nphies.sa/identifier/iqama'),
    passport: findIdentifier(fhir.identifier, 'https://nphies.sa/identifier/passport'),
    firstName: sanitize(name?.given?.[0], 100),
    middleName: sanitize(name?.given?.[1], 100),
    lastName: sanitize(name?.family, 100),
    fullName: sanitize(name?.text || [name?.given?.join(' '), name?.family].filter(Boolean).join(' '), 300),
    gender: genderMap[fhir.gender || 'unknown'] || 'UNKNOWN',
    dob: toDate(fhir.birthDate),
    mobile: sanitize(phone?.value, 20),
    email: sanitize(email?.value, 200),
    nationality: sanitize(fhir.address?.[0]?.country, 50),
    status: fhir.active === false ? 'MERGED' : 'KNOWN',
  };
}

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

export function fromFhirEncounter(fhir: FhirEncounter): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    planned: 'CREATED', arrived: 'ACTIVE', triaged: 'ACTIVE',
    'in-progress': 'ACTIVE', finished: 'CLOSED', cancelled: 'CLOSED',
  };

  const typeMap: Record<string, string> = {
    EMER: 'ER', AMB: 'OPD', IMP: 'IPD',
  };

  const classCode = fhir.class?.code || 'AMB';

  return {
    encounterType: typeMap[classCode] || 'OPD',
    status: statusMap[fhir.status] || 'CREATED',
    patientId: fhir.subject?.reference?.replace('Patient/', ''),
    department: fhir.type?.[0]?.text,
    openedAt: toDate(fhir.period?.start),
    closedAt: toDate(fhir.period?.end),
  };
}

// ---------------------------------------------------------------------------
// Observation (Lab Result)
// ---------------------------------------------------------------------------

export function fromFhirObservation(fhir: FhirObservation): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    registered: 'PENDING', preliminary: 'PRELIMINARY',
    final: 'FINAL', amended: 'AMENDED', cancelled: 'CANCELLED',
  };

  const interpMap: Record<string, string> = {
    H: 'H', HH: 'HH', L: 'L', LL: 'LL', N: 'N',
  };

  const interpretation = fhir.interpretation?.[0]?.coding?.[0]?.code;

  return {
    testCode: fhir.code?.coding?.[0]?.code || '',
    testName: fhir.code?.text || fhir.code?.coding?.[0]?.display || '',
    value: fhir.valueQuantity?.value ?? fhir.valueString ?? '',
    unit: fhir.valueQuantity?.unit || '',
    status: statusMap[fhir.status] || 'FINAL',
    flag: interpretation ? interpMap[interpretation] : undefined,
    patientId: fhir.subject?.reference?.replace('Patient/', ''),
    encounterId: fhir.encounter?.reference?.replace('Encounter/', ''),
    resultedAt: toDate(fhir.effectiveDateTime),
    verifiedAt: toDate(fhir.issued),
    referenceRange: fhir.referenceRange?.[0] ? {
      low: fhir.referenceRange[0].low?.value,
      high: fhir.referenceRange[0].high?.value,
      text: fhir.referenceRange[0].text,
    } : undefined,
  };
}

// ---------------------------------------------------------------------------
// ServiceRequest (Order)
// ---------------------------------------------------------------------------

export function fromFhirServiceRequest(fhir: FhirServiceRequest): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    draft: 'PLACED', active: 'PLACED', 'on-hold': 'PLACED',
    completed: 'COMPLETED', revoked: 'CANCELLED',
  };

  const priorityMap: Record<string, string> = {
    routine: 'ROUTINE', urgent: 'URGENT', stat: 'STAT', asap: 'URGENT',
  };

  const kindMap: Record<string, string> = {
    '108252007': 'LAB', '363679005': 'RADIOLOGY',
    '71388002': 'PROCEDURE', '182832007': 'MEDICATION',
  };

  const categoryCode = fhir.category?.[0]?.coding?.[0]?.code;

  return {
    kind: categoryCode ? kindMap[categoryCode] || 'LAB' : 'LAB',
    status: statusMap[fhir.status] || 'PLACED',
    priority: fhir.priority ? priorityMap[fhir.priority] || 'ROUTINE' : 'ROUTINE',
    orderCode: fhir.code?.coding?.[0]?.code || '',
    orderName: fhir.code?.text || fhir.code?.coding?.[0]?.display || '',
    patientMasterId: fhir.subject?.reference?.replace('Patient/', ''),
    encounterCoreId: fhir.encounter?.reference?.replace('Encounter/', ''),
    orderedAt: toDate(fhir.authoredOn),
    clinicalText: fhir.note?.[0]?.text,
  };
}

// ---------------------------------------------------------------------------
// Condition (Diagnosis)
// ---------------------------------------------------------------------------

export function fromFhirCondition(fhir: FhirCondition): Record<string, unknown> {
  return {
    icdCode: fhir.code?.coding?.[0]?.code || '',
    description: fhir.code?.text || fhir.code?.coding?.[0]?.display || '',
    status: fhir.clinicalStatus?.coding?.[0]?.code || 'active',
    patientId: fhir.subject?.reference?.replace('Patient/', ''),
    encounterId: fhir.encounter?.reference?.replace('Encounter/', ''),
    onsetDate: toDate(fhir.onsetDateTime),
  };
}

// ---------------------------------------------------------------------------
// AllergyIntolerance
// ---------------------------------------------------------------------------

export function fromFhirAllergyIntolerance(fhir: FhirAllergyIntolerance): Record<string, unknown> {
  const categoryMap: Record<string, string> = {
    medication: 'DRUG', food: 'FOOD', environment: 'ENVIRONMENTAL', biologic: 'OTHER',
  };

  const severityMap: Record<string, string> = {
    low: 'MILD', high: 'SEVERE',
  };

  return {
    allergen: fhir.code?.text || fhir.code?.coding?.[0]?.display || '',
    allergyType: fhir.category?.[0] ? categoryMap[fhir.category[0]] || 'OTHER' : 'OTHER',
    severity: fhir.criticality ? severityMap[fhir.criticality] || 'MODERATE' : 'MODERATE',
    patientId: fhir.patient?.reference?.replace('Patient/', ''),
    reaction: fhir.reaction?.[0]?.manifestation?.[0]?.text || fhir.reaction?.[0]?.description,
    isActive: fhir.clinicalStatus?.coding?.[0]?.code !== 'inactive',
  };
}

// ---------------------------------------------------------------------------
// MedicationRequest
// ---------------------------------------------------------------------------

export function fromFhirMedicationRequest(fhir: FhirMedicationRequest): Record<string, unknown> {
  return {
    drugName: fhir.medicationCodeableConcept?.text || fhir.medicationCodeableConcept?.coding?.[0]?.display || '',
    patientId: fhir.subject?.reference?.replace('Patient/', ''),
    encounterId: fhir.encounter?.reference?.replace('Encounter/', ''),
    dose: fhir.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value,
    unit: fhir.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit,
    route: fhir.dosageInstruction?.[0]?.route?.text,
    frequency: fhir.dosageInstruction?.[0]?.text,
    isActive: fhir.status === 'active',
  };
}

// ---------------------------------------------------------------------------
// Coverage (Insurance)
// ---------------------------------------------------------------------------

export function fromFhirCoverage(fhir: FhirCoverage): Record<string, unknown> {
  return {
    patientId: fhir.beneficiary?.reference?.replace('Patient/', ''),
    payerName: fhir.payor?.[0]?.display,
    memberId: fhir.subscriberId,
    policyNumber: fhir.class?.find((c) => c.type?.coding?.[0]?.code === 'plan')?.value,
    planName: fhir.class?.find((c) => c.type?.coding?.[0]?.code === 'plan')?.name,
    planType: fhir.type?.text,
    status: fhir.status === 'active' ? 'ACTIVE' : 'INACTIVE',
    effectiveDate: toDate(fhir.period?.start),
    expiryDate: toDate(fhir.period?.end),
    isPrimary: true,
  };
}
