// Phase 5.4 — FHIR R4 Patient serializer
// Pure function: PatientMaster (Prisma) → FhirPatient
import type { PatientMaster } from '@prisma/client';
import type { FhirPatient, FhirIdentifier, FhirContactPoint } from '../resources/types';

const THEA_SYSTEM = 'https://thea.com.sa/fhir';

const GENDER_MAP: Record<string, 'male' | 'female' | 'other' | 'unknown'> = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

export function serializePatient(p: PatientMaster): FhirPatient {
  const identifiers: FhirIdentifier[] = [];
  if (p.mrn)       identifiers.push({ use: 'usual',    system: `${THEA_SYSTEM}/mrn`,                        value: p.mrn });
  if (p.nationalId) identifiers.push({ use: 'official', system: 'https://nphies.sa/identifier/nid',          value: p.nationalId });
  if (p.iqama)     identifiers.push({                   system: 'https://nphies.sa/identifier/iqama',        value: p.iqama });
  if (p.passport)  identifiers.push({                   system: 'https://nphies.sa/identifier/passport',     value: p.passport });

  const telecom: FhirContactPoint[] = [];
  if (p.mobile) telecom.push({ system: 'phone', value: p.mobile, use: 'mobile' });
  if (p.email)  telecom.push({ system: 'email', value: p.email });

  return {
    resourceType: 'Patient',
    id: p.id,
    meta: {
      lastUpdated: p.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
    },
    identifier: identifiers.length > 0 ? identifiers : undefined,
    active: p.status !== 'MERGED',
    name: [{
      use: 'official',
      text: p.fullName,
      family: p.lastName,
      given: [p.firstName, p.middleName].filter((n): n is string => !!n),
    }],
    telecom: telecom.length > 0 ? telecom : undefined,
    gender: GENDER_MAP[p.gender] ?? 'unknown',
    birthDate: p.dob ? p.dob.toISOString().split('T')[0] : undefined,
    address: p.nationality ? [{ country: p.nationality }] : undefined,
  };
}
