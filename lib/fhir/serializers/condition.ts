// Phase 7.7 — FHIR R4 Condition serializer
// Async pure function: PatientProblem (Prisma) → FhirCondition
// Attaches ICD-10-AM coding when FF_ONTOLOGY_ENABLED is ON and the problem's
// catalog code resolves to a DiagnosisCatalog row that has been mapped to an
// ICD-10 OntologyConcept via the Phase 7.3 wiring layer.
//
// Discovery: PatientProblem is the canonical FHIR Condition source — it has
// problemName, status, onsetDate, resolvedDate, severity, plus a free-text
// `code` (catalog) and `icdCode` (free text). The serializer always emits the
// `icdCode` directly when present and additionally enriches with the verified
// OntologyConcept when the wiring flag is on.
import type { PatientProblem } from '@prisma/client';
import type { FhirCondition, FhirCoding, FhirCodeableConcept } from '../resources/types';
import { prisma } from '@/lib/db/prisma';
import { findIcd10ConceptForDiagnosis } from '@/lib/ontology/wiring/diagnosisCatalog';

const THEA_SYSTEM      = 'https://thea.com.sa/fhir';
const ICD10_SYSTEM     = 'http://hl7.org/fhir/sid/icd-10-am';
const CLINICAL_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-clinical';

const CLINICAL_STATUS_MAP: Record<string, 'active' | 'resolved' | 'inactive'> = {
  active:   'active',
  resolved: 'resolved',
  inactive: 'inactive',
};

function clinicalStatusConcept(status: string): FhirCodeableConcept {
  const code = CLINICAL_STATUS_MAP[status] ?? 'active';
  return { coding: [{ system: CLINICAL_STATUS_SYSTEM, code, display: code }] };
}

export async function serializeCondition(
  p: PatientProblem,
  tenantId: string,
): Promise<FhirCondition> {
  const coding: FhirCoding[] = [];

  if (p.code) {
    coding.push({
      system:  `${THEA_SYSTEM}/diagnosis`,
      code:    p.code,
      display: p.problemName,
    });
  }
  // Direct ICD-10 free-text from the problem row, when present and distinct
  // from the catalog code.
  if (p.icdCode && p.icdCode !== p.code) {
    coding.push({
      system:  ICD10_SYSTEM,
      code:    p.icdCode,
      display: p.problemName,
    });
  }

  // Best-effort ICD-10-AM enrichment via the Phase 7.3 wiring layer. We
  // resolve the problem's catalog code to a DiagnosisCatalog row in this
  // tenant, then call findIcd10ConceptForDiagnosis(diagnosisId). Misses are
  // silent — never throws, never blocks the read.
  if (p.code) {
    const dx = await prisma.diagnosisCatalog.findFirst({
      where:  { tenantId, code: p.code },
      select: { id: true },
    });
    if (dx) {
      const concept = await findIcd10ConceptForDiagnosis(dx.id);
      if (concept) {
        // Only append if not already present from the free-text icdCode.
        const already = coding.some(
          (c) => c.system === ICD10_SYSTEM && c.code === concept.code,
        );
        if (!already) {
          coding.push({
            system:  ICD10_SYSTEM,
            code:    concept.code,
            display: concept.display ?? p.problemName,
          });
        }
      }
    }
  }

  return {
    resourceType: 'Condition',
    id: p.id,
    meta: {
      lastUpdated: p.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Condition'],
    },
    clinicalStatus: clinicalStatusConcept(p.status),
    verificationStatus: {
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code:    'unconfirmed',
        display: 'Unconfirmed',
      }],
    },
    code: {
      coding: coding.length > 0 ? coding : undefined,
      text:   p.problemName,
    },
    subject: { reference: `Patient/${p.patientId}`, type: 'Patient' },
    onsetDateTime:     p.onsetDate?.toISOString(),
    abatementDateTime: p.resolvedDate?.toISOString(),
    recordedDate:      p.createdAt.toISOString(),
    note: p.notes ? [{ text: p.notes }] : undefined,
  };
}
