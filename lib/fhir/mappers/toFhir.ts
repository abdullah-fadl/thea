/**
 * Thea → FHIR R4 Mappers
 *
 * Converts internal Thea EHR data structures to FHIR R4 resources.
 * Each mapper handles one resource type and returns a valid FHIR object.
 */

import type {
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  FhirDiagnosticReport,
  FhirImagingStudy,
  FhirMedicationRequest,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirProcedure,
  FhirServiceRequest,
  FhirOrganization,
  FhirPractitioner,
  FhirCoverage,
  FhirCoding,
  FhirResource,
  FhirBundle,
  FhirBundleEntry,
} from '../resources/types';

const THEA_SYSTEM = 'https://thea.com.sa/fhir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isoDateOnly(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
}

function ref(resourceType: string, id: string, display?: string) {
  return { reference: `${resourceType}/${id}`, type: resourceType, display };
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export function toFhirPatient(p: Record<string, unknown>): FhirPatient {
  const identifiers = [];

  if (p.mrn) identifiers.push({ use: 'usual' as const, system: `${THEA_SYSTEM}/mrn`, value: String(p.mrn) });
  if (p.nationalId) identifiers.push({ use: 'official' as const, system: 'https://nphies.sa/identifier/nid', value: String(p.nationalId) });
  if (p.iqama) identifiers.push({ system: 'https://nphies.sa/identifier/iqama', value: String(p.iqama) });
  if (p.passport) identifiers.push({ system: 'https://nphies.sa/identifier/passport', value: String(p.passport) });

  const telecom = [];
  if (p.mobile) telecom.push({ system: 'phone' as const, value: String(p.mobile), use: 'mobile' as const });
  if (p.email) telecom.push({ system: 'email' as const, value: String(p.email) });

  const genderMap: Record<string, 'male' | 'female' | 'other' | 'unknown'> = {
    MALE: 'male', FEMALE: 'female', OTHER: 'other', UNKNOWN: 'unknown',
    male: 'male', female: 'female',
  };

  return {
    resourceType: 'Patient',
    id: String(p.id || ''),
    meta: { lastUpdated: isoDate(p.updatedAt as string), profile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
    identifier: identifiers.length > 0 ? identifiers : undefined,
    active: p.status !== 'MERGED',
    name: [{
      use: 'official',
      text: String(p.fullName || p.displayName || ''),
      family: String(p.lastName || ''),
      given: [p.firstName, p.middleName].filter(Boolean).map(String),
    }],
    telecom: telecom.length > 0 ? telecom : undefined,
    gender: genderMap[String(p.gender || 'UNKNOWN')] || 'unknown',
    birthDate: isoDateOnly(p.dob as string),
    address: p.nationality ? [{ country: String(p.nationality) }] : undefined,
    contact: p.emergencyContact ? [{
      relationship: [{ text: 'Emergency Contact' }],
      name: { text: String((p.emergencyContact as Record<string, unknown>)?.name || '') },
      telecom: (p.emergencyContact as Record<string, unknown>)?.phone
        ? [{ system: 'phone', value: String((p.emergencyContact as Record<string, unknown>).phone) }]
        : undefined,
    }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

export function toFhirEncounter(e: Record<string, unknown>): FhirEncounter {
  const statusMap: Record<string, FhirEncounter['status']> = {
    CREATED: 'planned',
    ACTIVE: 'in-progress',
    OPEN: 'in-progress',
    CLOSED: 'finished',
    COMPLETED: 'finished',
    CANCELLED: 'cancelled',
  };

  const classMap: Record<string, FhirCoding> = {
    ER: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'Emergency' },
    OPD: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'Ambulatory' },
    IPD: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'Inpatient' },
    PROCEDURE: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'Ambulatory' },
  };

  return {
    resourceType: 'Encounter',
    id: String(e.id || ''),
    meta: { lastUpdated: isoDate(e.updatedAt as string) },
    status: statusMap[String(e.status || '')] || 'unknown',
    class: classMap[String(e.encounterType || 'OPD')] || classMap.OPD,
    type: e.department ? [{ text: String(e.department) }] : undefined,
    subject: e.patientId ? ref('Patient', String(e.patientId)) : undefined,
    period: {
      start: isoDate(e.openedAt as string) || isoDate(e.createdAt as string),
      end: isoDate(e.closedAt as string),
    },
    serviceProvider: e.tenantId ? ref('Organization', String(e.tenantId)) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Observation (Lab Result or Vitals)
// ---------------------------------------------------------------------------

export function toFhirObservation(
  obs: Record<string, unknown>,
  category: 'laboratory' | 'vital-signs' = 'laboratory',
): FhirObservation {
  const statusMap: Record<string, FhirObservation['status']> = {
    PRELIMINARY: 'preliminary',
    FINAL: 'final',
    AMENDED: 'amended',
    CANCELLED: 'cancelled',
    VERIFIED: 'final',
    PENDING: 'registered',
  };

  const value = obs.value;
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)));

  const observation: FhirObservation = {
    resourceType: 'Observation',
    id: String(obs.id || ''),
    meta: { lastUpdated: isoDate(obs.updatedAt as string) },
    status: statusMap[String(obs.status || 'FINAL')] || 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: category,
        display: category === 'laboratory' ? 'Laboratory' : 'Vital Signs',
      }],
    }],
    code: {
      coding: obs.testCode ? [{
        system: 'http://loinc.org',
        code: String(obs.testCode),
        display: String(obs.testName || obs.testCode),
      }] : undefined,
      text: String(obs.testName || obs.testCode || ''),
    },
    subject: obs.patientId ? ref('Patient', String(obs.patientId)) : undefined,
    encounter: obs.encounterId ? ref('Encounter', String(obs.encounterId)) : undefined,
    effectiveDateTime: isoDate(obs.resultedAt as string) || isoDate(obs.createdAt as string),
    issued: isoDate(obs.verifiedAt as string),
  };

  // Set value
  if (isNumeric) {
    observation.valueQuantity = {
      value: Number(value),
      unit: String(obs.unit || ''),
      system: 'http://unitsofmeasure.org',
    };
  } else if (value != null) {
    observation.valueString = String(value);
  }

  // Interpretation (abnormal flags)
  const flag = String(obs.flag || obs.abnormalFlag || '').toUpperCase();
  if (flag) {
    const interpMap: Record<string, FhirCoding> = {
      H: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'High' },
      HH: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'HH', display: 'Critical High' },
      L: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: 'Low' },
      LL: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'LL', display: 'Critical Low' },
      N: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Normal' },
    };
    if (interpMap[flag]) {
      observation.interpretation = [{ coding: [interpMap[flag]] }];
    }
  }

  // Reference range
  const refRange = obs.referenceRange as Record<string, unknown> | undefined;
  if (refRange) {
    observation.referenceRange = [{
      low: refRange.low != null ? { value: Number(refRange.low), unit: String(obs.unit || '') } : undefined,
      high: refRange.high != null ? { value: Number(refRange.high), unit: String(obs.unit || '') } : undefined,
      text: refRange.text ? String(refRange.text) : undefined,
    }];
  }

  return observation;
}

// ---------------------------------------------------------------------------
// DiagnosticReport
// ---------------------------------------------------------------------------

export function toFhirDiagnosticReport(r: Record<string, unknown>): FhirDiagnosticReport {
  const isRadiology = String(r.resultType || r.kind || '').toUpperCase() === 'RADIOLOGY';

  return {
    resourceType: 'DiagnosticReport',
    id: String(r.id || ''),
    meta: { lastUpdated: isoDate(r.updatedAt as string) },
    status: mapReportStatus(String(r.status || '')),
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: isRadiology ? 'RAD' : 'LAB',
        display: isRadiology ? 'Radiology' : 'Laboratory',
      }],
    }],
    code: {
      coding: r.examCode || r.testCode ? [{
        system: 'http://loinc.org',
        code: String(r.examCode || r.testCode || ''),
        display: String(r.examName || r.testName || ''),
      }] : undefined,
      text: String(r.examName || r.testName || ''),
    },
    subject: r.patientId ? ref('Patient', String(r.patientId)) : undefined,
    encounter: r.encounterId || r.encounterCoreId ? ref('Encounter', String(r.encounterId || r.encounterCoreId)) : undefined,
    effectiveDateTime: isoDate(r.resultedAt as string) || isoDate(r.createdAt as string),
    issued: isoDate(r.verifiedAt as string),
    conclusion: r.impression ? String(r.impression) : r.summary ? String(r.summary) : undefined,
  };
}

function mapReportStatus(s: string): FhirDiagnosticReport['status'] {
  const map: Record<string, FhirDiagnosticReport['status']> = {
    PRELIMINARY: 'preliminary', FINAL: 'final', AMENDED: 'amended',
    CANCELLED: 'cancelled', VERIFIED: 'final', COMPLETED: 'final',
    PENDING: 'registered', DRAFT: 'partial',
  };
  return map[s.toUpperCase()] || 'unknown';
}

// ---------------------------------------------------------------------------
// ImagingStudy
// ---------------------------------------------------------------------------

export function toFhirImagingStudy(s: Record<string, unknown>): FhirImagingStudy {
  return {
    resourceType: 'ImagingStudy',
    id: String(s.id || s.studyInstanceUID || ''),
    status: 'available',
    modality: s.modality ? [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: String(s.modality) }] : undefined,
    subject: ref('Patient', String(s.patientId || '')),
    encounter: s.encounterId ? ref('Encounter', String(s.encounterId)) : undefined,
    started: isoDate(s.studyDate as string),
    description: s.studyDescription ? String(s.studyDescription) : undefined,
    numberOfSeries: typeof s.numberOfSeries === 'number' ? s.numberOfSeries : undefined,
    numberOfInstances: typeof s.numberOfInstances === 'number' ? s.numberOfInstances : undefined,
  };
}

// ---------------------------------------------------------------------------
// MedicationRequest
// ---------------------------------------------------------------------------

export function toFhirMedicationRequest(m: Record<string, unknown>): FhirMedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id: String(m.id || ''),
    meta: { lastUpdated: isoDate(m.updatedAt as string) },
    status: m.isActive === false ? 'completed' : 'active',
    intent: 'order',
    medicationCodeableConcept: {
      text: String(m.drugName || m.medicationName || ''),
    },
    subject: ref('Patient', String(m.patientId || '')),
    encounter: m.encounterId ? ref('Encounter', String(m.encounterId)) : undefined,
    authoredOn: isoDate(m.createdAt as string),
    dosageInstruction: [{
      text: [m.dose, m.unit, m.route, m.frequency].filter(Boolean).map(String).join(' '),
      route: m.route ? { text: String(m.route) } : undefined,
      doseAndRate: m.dose ? [{ doseQuantity: { value: Number(m.dose) || undefined, unit: String(m.unit || '') } }] : undefined,
    }],
  };
}

// ---------------------------------------------------------------------------
// Condition (Diagnoses)
// ---------------------------------------------------------------------------

export function toFhirCondition(c: Record<string, unknown>): FhirCondition {
  const statusMap: Record<string, string> = {
    active: 'active', resolved: 'resolved', inactive: 'inactive',
    ACTIVE: 'active', RESOLVED: 'resolved', INACTIVE: 'inactive',
  };
  const clinicalStatus = statusMap[String(c.status || 'active')] || 'active';

  return {
    resourceType: 'Condition',
    id: String(c.id || ''),
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: clinicalStatus,
      }],
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed',
      }],
    },
    code: {
      coding: c.icdCode ? [{
        system: 'http://hl7.org/fhir/sid/icd-10',
        code: String(c.icdCode || c.code || ''),
        display: String(c.description || c.name || ''),
      }] : undefined,
      text: String(c.description || c.name || ''),
    },
    subject: ref('Patient', String(c.patientId || '')),
    encounter: c.encounterId ? ref('Encounter', String(c.encounterId)) : undefined,
    onsetDateTime: isoDate(c.onsetDate as string),
    recordedDate: isoDate(c.createdAt as string),
  };
}

// ---------------------------------------------------------------------------
// AllergyIntolerance
// ---------------------------------------------------------------------------

export function toFhirAllergyIntolerance(a: Record<string, unknown>): FhirAllergyIntolerance {
  const categoryMap: Record<string, 'food' | 'medication' | 'environment' | 'biologic'> = {
    DRUG: 'medication', FOOD: 'food', ENVIRONMENTAL: 'environment', OTHER: 'biologic',
    drug: 'medication', food: 'food', environmental: 'environment',
  };

  const criticalityMap: Record<string, 'low' | 'high' | 'unable-to-assess'> = {
    MILD: 'low', MODERATE: 'low', SEVERE: 'high',
    mild: 'low', moderate: 'low', severe: 'high',
  };

  return {
    resourceType: 'AllergyIntolerance',
    id: String(a.id || ''),
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: a.isActive === false ? 'inactive' : 'active',
      }],
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: 'confirmed',
      }],
    },
    type: 'allergy',
    category: a.allergyType ? [categoryMap[String(a.allergyType)] || 'biologic'] : undefined,
    criticality: a.severity ? criticalityMap[String(a.severity)] : undefined,
    code: { text: String(a.allergen || a.substance || '') },
    patient: ref('Patient', String(a.patientId || '')),
    recordedDate: isoDate(a.createdAt as string),
    reaction: a.reaction ? [{
      manifestation: [{ text: String(a.reaction) }],
      severity: a.severity === 'SEVERE' ? 'severe' : a.severity === 'MODERATE' ? 'moderate' : 'mild',
    }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// ServiceRequest (Orders)
// ---------------------------------------------------------------------------

export function toFhirServiceRequest(o: Record<string, unknown>): FhirServiceRequest {
  const statusMap: Record<string, FhirServiceRequest['status']> = {
    PLACED: 'active', ACCEPTED: 'active', IN_PROGRESS: 'active',
    RESULT_READY: 'completed', COMPLETED: 'completed', CANCELLED: 'revoked',
  };

  const priorityMap: Record<string, FhirServiceRequest['priority']> = {
    ROUTINE: 'routine', URGENT: 'urgent', STAT: 'stat',
    NORMAL: 'routine', HIGH: 'urgent', LOW: 'routine', ASAP: 'asap',
  };

  const categoryMap: Record<string, FhirCoding> = {
    LAB: { system: 'http://snomed.info/sct', code: '108252007', display: 'Laboratory procedure' },
    RADIOLOGY: { system: 'http://snomed.info/sct', code: '363679005', display: 'Imaging' },
    PROCEDURE: { system: 'http://snomed.info/sct', code: '71388002', display: 'Procedure' },
    MEDICATION: { system: 'http://snomed.info/sct', code: '182832007', display: 'Medication request' },
  };

  return {
    resourceType: 'ServiceRequest',
    id: String(o.id || ''),
    meta: { lastUpdated: isoDate(o.updatedAt as string) },
    status: statusMap[String(o.status || '')] || 'unknown',
    intent: 'order',
    category: o.kind ? [{ coding: [categoryMap[String(o.kind)] || categoryMap.LAB] }] : undefined,
    priority: priorityMap[String(o.priority || 'ROUTINE')],
    code: {
      coding: o.orderCode ? [{
        system: `${THEA_SYSTEM}/order-code`,
        code: String(o.orderCode),
        display: String(o.orderName || ''),
      }] : undefined,
      text: String(o.orderName || ''),
    },
    subject: ref('Patient', String(o.patientMasterId || o.patientId || '')),
    encounter: o.encounterCoreId || o.encounterId ? ref('Encounter', String(o.encounterCoreId || o.encounterId)) : undefined,
    authoredOn: isoDate(o.orderedAt as string) || isoDate(o.createdAt as string),
    note: o.clinicalText || o.notes ? [{ text: String(o.clinicalText || o.notes || '') }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Practitioner
// ---------------------------------------------------------------------------

export function toFhirPractitioner(u: Record<string, unknown>): FhirPractitioner {
  return {
    resourceType: 'Practitioner',
    id: String(u.id || ''),
    active: u.isArchived !== true,
    name: [{
      text: String(u.displayName || u.fullName || ''),
    }],
    telecom: u.email ? [{ system: 'email', value: String(u.email) }] : undefined,
    identifier: u.staffId ? [{
      system: `${THEA_SYSTEM}/staff-id`,
      value: String(u.staffId),
    }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Coverage (Insurance)
// ---------------------------------------------------------------------------

export function toFhirCoverage(c: Record<string, unknown>): FhirCoverage {
  return {
    resourceType: 'Coverage',
    id: String(c.id || ''),
    status: c.status === 'INACTIVE' || c.status === 'EXPIRED' ? 'cancelled' : 'active',
    type: { text: String(c.planType || 'Health Insurance') },
    beneficiary: ref('Patient', String(c.patientId || '')),
    subscriberId: c.memberId ? String(c.memberId) : undefined,
    period: {
      start: isoDateOnly(c.effectiveDate as string),
      end: isoDateOnly(c.expiryDate as string),
    },
    payor: [{
      display: String(c.payerName || c.insurerName || ''),
    }],
    class: c.policyNumber ? [{
      type: { coding: [{ code: 'plan' }] },
      value: String(c.policyNumber),
      name: c.planName ? String(c.planName) : undefined,
    }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export function toFhirProcedure(p: Record<string, unknown>): FhirProcedure {
  return {
    resourceType: 'Procedure',
    id: String(p.id || ''),
    status: String(p.status || 'completed').toLowerCase() as FhirProcedure['status'],
    code: { text: String(p.orderName || p.title || p.procedureName || '') },
    subject: ref('Patient', String(p.patientId || p.patientMasterId || '')),
    encounter: p.encounterId || p.encounterCoreId ? ref('Encounter', String(p.encounterId || p.encounterCoreId)) : undefined,
    performedDateTime: isoDate(p.completedAt as string) || isoDate(p.performedAt as string),
  };
}

// ---------------------------------------------------------------------------
// Bundle Builder
// ---------------------------------------------------------------------------

export function buildSearchBundle(
  resources: FhirBundle['entry'],
  total: number,
  baseUrl: string,
  resourceType?: string,
): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total,
    link: [
      { relation: 'self', url: `${baseUrl}/api/fhir${resourceType ? `/${resourceType}` : ''}` },
    ],
    entry: resources,
    timestamp: new Date().toISOString(),
  };
}

export function buildEntry(resource: Record<string, unknown>, baseUrl: string): FhirBundleEntry {
  return {
    fullUrl: `${baseUrl}/api/fhir/${resource.resourceType}/${resource.id}`,
    resource: resource as unknown as FhirResource,
    search: { mode: 'match' },
  };
}
