// =============================================================================
// Phase 7.3 — DiagnosisCatalog ↔ ICD-10-AM wiring
//
// Mirrors lib/ontology/wiring/formularyDrug.ts for the
// DiagnosisCatalog.icd10 string code. Reads existing rows, looks up or
// lazily creates the corresponding OntologyConcept in the ICD_10_AM code
// system, and persists an OntologyMapping with source = 'inferred'.
//
// Flag-gated by FF_ONTOLOGY_ENABLED.
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { OntologyDisabled, OntologyNotFound } from '../errors';
import { ensureConcept } from '../lazyUpsert';
import { mapEntityToConcept } from '../mapping';
import type { OntologyConcept, OntologyMapping } from '@prisma/client';

export const DIAGNOSIS_CATALOG_ENTITY_TYPE = 'diagnosis_catalog';
export const DIAGNOSIS_CATALOG_ICD10_SYSTEM = 'ICD_10_AM' as const;

export type MapDiagnosisCatalogResult =
  | { skipped: true; reason: 'no_icd10_code' | 'diagnosis_not_found' }
  | { skipped: false; mapping: OntologyMapping; concept: OntologyConcept };

/**
 * Wire a single DiagnosisCatalog row to its ICD-10-AM OntologyConcept.
 *
 * Behavior mirrors mapFormularyDrugToRxNorm:
 *   - Reads the diagnosis row.
 *   - Skips if icd10 is null/empty.
 *   - Lazily upserts an OntologyConcept (display = name, code = icd10).
 *   - Upserts an OntologyMapping with source = 'inferred'.
 *
 * @throws OntologyDisabled when FF_ONTOLOGY_ENABLED is OFF.
 * @throws OntologyNotFound when the ICD_10_AM code system is not seeded.
 */
export async function mapDiagnosisCatalogToIcd10(
  diagnosisId: string,
): Promise<MapDiagnosisCatalogResult> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) throw new OntologyDisabled();

  const diagnosis = await prisma.diagnosisCatalog.findUnique({
    where: { id: diagnosisId },
    select: { id: true, tenantId: true, icd10: true, name: true },
  });

  if (!diagnosis) {
    return { skipped: true, reason: 'diagnosis_not_found' };
  }

  const icd10Code = diagnosis.icd10?.trim();
  if (!icd10Code) {
    return { skipped: true, reason: 'no_icd10_code' };
  }

  const concept = await ensureConcept({
    codeSystem: DIAGNOSIS_CATALOG_ICD10_SYSTEM,
    code: icd10Code,
    tenantId: diagnosis.tenantId,
    displayHint: diagnosis.name,
  });

  const mapping = await mapEntityToConcept({
    tenantId: diagnosis.tenantId,
    entityType: DIAGNOSIS_CATALOG_ENTITY_TYPE,
    entityId: diagnosis.id,
    conceptId: concept.id,
    mappingType: 'primary',
    source: 'inferred',
  });

  return { skipped: false, mapping, concept };
}

/**
 * Read-only lookup: return the linked ICD-10-AM OntologyConcept for the
 * diagnosis, or null if no mapping exists.
 *
 * Returns null when FF_ONTOLOGY_ENABLED is OFF, when the diagnosis does not
 * exist, or when no mapping has been created yet.
 */
export async function findIcd10ConceptForDiagnosis(
  diagnosisId: string,
): Promise<OntologyConcept | null> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) return null;

  const diagnosis = await prisma.diagnosisCatalog.findUnique({
    where: { id: diagnosisId },
    select: { id: true, tenantId: true },
  });
  if (!diagnosis) return null;

  const system = await prisma.ontologyCodeSystem.findUnique({
    where: { code: DIAGNOSIS_CATALOG_ICD10_SYSTEM },
    select: { id: true },
  });
  if (!system) {
    throw new OntologyNotFound(`OntologyCodeSystem '${DIAGNOSIS_CATALOG_ICD10_SYSTEM}' is not seeded`);
  }

  const mapping = await prisma.ontologyMapping.findFirst({
    where: {
      tenantId: diagnosis.tenantId,
      entityType: DIAGNOSIS_CATALOG_ENTITY_TYPE,
      entityId: diagnosis.id,
      concept: { codeSystemId: system.id },
    },
    include: { concept: true },
    orderBy: { createdAt: 'asc' },
  });

  return mapping?.concept ?? null;
}
