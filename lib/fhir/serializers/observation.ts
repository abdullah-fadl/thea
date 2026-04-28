// Phase 5.4 — FHIR R4 Observation serializer
// Async pure function: LabResult (Prisma) → FhirObservation
// Attaches LOINC coding when FF_ONTOLOGY_ENABLED is ON and a concept is found.
import type { LabResult } from '@prisma/client';
import type { FhirObservation, FhirCoding } from '../resources/types';
import { findConceptByCode } from '@/lib/ontology/lookup';

const THEA_SYSTEM = 'https://thea.com.sa/fhir';
const LOINC_SYSTEM = 'http://loinc.org';

const STATUS_MAP: Record<string, FhirObservation['status']> = {
  PENDING:     'registered',
  IN_PROGRESS: 'preliminary',
  RESULTED:    'preliminary',
  VERIFIED:    'final',
  CANCELLED:   'cancelled',
};

export async function serializeObservation(o: LabResult, tenantId: string): Promise<FhirObservation> {
  const coding: FhirCoding[] = [];

  if (o.testCode) {
    coding.push({
      system:  `${THEA_SYSTEM}/lab-test`,
      code:    o.testCode,
      display: o.testName ?? undefined,
    });

    const concept = await findConceptByCode('LOINC', o.testCode, tenantId);
    if (concept) {
      coding.push({
        system:  LOINC_SYSTEM,
        code:    concept.code,
        display: concept.display ?? undefined,
      });
    }
  }

  return {
    resourceType: 'Observation',
    id: o.id,
    meta: {
      lastUpdated: o.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation'],
    },
    status: STATUS_MAP[o.status] ?? 'unknown',
    category: [{
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/observation-category',
        code:    'laboratory',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: coding.length > 0 ? coding : undefined,
      text:   o.testName ?? undefined,
    },
    subject:           o.patientId   ? { reference: `Patient/${o.patientId}`,     type: 'Patient'   } : undefined,
    encounter:         o.encounterId ? { reference: `Encounter/${o.encounterId}`, type: 'Encounter' } : undefined,
    effectiveDateTime: o.collectedAt?.toISOString(),
    issued:            o.resultedAt?.toISOString() ?? o.verifiedAt?.toISOString(),
    note:              o.comments ? [{ text: o.comments }] : undefined,
  };
}
