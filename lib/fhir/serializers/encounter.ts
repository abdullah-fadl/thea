// Phase 5.4 — FHIR R4 Encounter serializer
// Pure function: EncounterCore (Prisma) → FhirEncounter
import type { EncounterCore } from '@prisma/client';
import type { FhirEncounter } from '../resources/types';

const STATUS_MAP: Record<string, FhirEncounter['status']> = {
  CREATED: 'planned',
  ACTIVE:  'in-progress',
  CLOSED:  'finished',
};

const CLASS_MAP: Record<string, { system: string; code: string; display: string }> = {
  ER:        { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER',  display: 'emergency' },
  OPD:       { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB',   display: 'ambulatory' },
  IPD:       { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP',   display: 'inpatient encounter' },
  PROCEDURE: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'PRENC', display: 'pre-admission' },
};

export function serializeEncounter(e: EncounterCore): FhirEncounter {
  const cls = CLASS_MAP[e.encounterType] ?? CLASS_MAP.OPD;

  return {
    resourceType: 'Encounter',
    id: e.id,
    meta: {
      lastUpdated: e.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter'],
    },
    status: STATUS_MAP[e.status] ?? 'unknown',
    class: cls,
    subject: { reference: `Patient/${e.patientId}`, type: 'Patient' },
    period: {
      start: e.openedAt?.toISOString(),
      end:   e.closedAt?.toISOString(),
    },
    serviceType: e.department ? { text: e.department } : undefined,
  };
}
