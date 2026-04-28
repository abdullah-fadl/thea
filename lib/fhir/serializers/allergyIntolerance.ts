// Phase 7.7 — FHIR R4 AllergyIntolerance serializer
// Pure (sync) function: PatientAllergy (Prisma) → FhirAllergyIntolerance
// No ontology lookup is performed; the source rows store free-text allergens
// without a SNOMED/RxNorm mapping. Future phases may attach SNOMED CT codes.
import type { PatientAllergy } from '@prisma/client';
import type {
  FhirAllergyIntolerance,
  FhirCodeableConcept,
} from '../resources/types';

const CLINICAL_STATUS_SYSTEM     = 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical';
const VERIFICATION_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification';

const CATEGORY_MAP: Record<string, 'food' | 'medication' | 'environment' | 'biologic'> = {
  DRUG:          'medication',
  FOOD:          'food',
  ENVIRONMENTAL: 'environment',
  OTHER:         'biologic',
};

const CRITICALITY_MAP: Record<string, 'low' | 'high' | 'unable-to-assess'> = {
  mild:     'low',
  moderate: 'low',
  severe:   'high',
};

const REACTION_SEVERITY_MAP: Record<string, 'mild' | 'moderate' | 'severe'> = {
  mild:     'mild',
  moderate: 'moderate',
  severe:   'severe',
};

function clinicalStatus(status: string, nkda: boolean): FhirCodeableConcept | undefined {
  if (nkda) return undefined;
  const code = status === 'resolved' ? 'resolved' : status === 'inactive' ? 'inactive' : 'active';
  return { coding: [{ system: CLINICAL_STATUS_SYSTEM, code, display: code }] };
}

export function serializeAllergyIntolerance(a: PatientAllergy): FhirAllergyIntolerance {
  // NKDA (no known drug allergies) is encoded by FHIR convention as a record
  // whose code carries the SNOMED "no known allergy" placeholder. We surface
  // the database flag as text so receivers can render it explicitly.
  const code: FhirCodeableConcept = a.nkda
    ? { text: 'No known drug allergies' }
    : { text: a.allergen };

  return {
    resourceType: 'AllergyIntolerance',
    id: a.id,
    meta: {
      lastUpdated: a.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/AllergyIntolerance'],
    },
    clinicalStatus: clinicalStatus(a.status, a.nkda),
    verificationStatus: {
      coding: [{
        system:  VERIFICATION_STATUS_SYSTEM,
        code:    'unconfirmed',
        display: 'Unconfirmed',
      }],
    },
    type: a.type === 'DRUG' ? 'allergy' : 'intolerance',
    category: CATEGORY_MAP[a.type] ? [CATEGORY_MAP[a.type]] : undefined,
    criticality: a.severity ? CRITICALITY_MAP[a.severity] : undefined,
    code,
    patient: { reference: `Patient/${a.patientId}`, type: 'Patient' },
    onsetDateTime: a.onsetDate?.toISOString(),
    recordedDate:  a.createdAt.toISOString(),
    reaction: a.reaction
      ? [{
          manifestation: [{ text: a.reaction }],
          severity:      a.severity ? REACTION_SEVERITY_MAP[a.severity] : undefined,
          description:   a.notes ?? undefined,
        }]
      : undefined,
  };
}
