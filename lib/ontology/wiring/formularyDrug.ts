// =============================================================================
// Phase 7.3 — FormularyDrug ↔ RxNorm wiring
//
// Reads FormularyDrug.rxNorm (added in migration 20260425000003), looks up or
// lazily creates the corresponding OntologyConcept in the RXNORM code system,
// and persists an OntologyMapping (entityType = 'formulary_drug',
// source = 'inferred').
//
// All operations are flag-gated by FF_ONTOLOGY_ENABLED. With the flag OFF:
//   - mapFormularyDrugToRxNorm() throws OntologyDisabled (via ensureConcept).
//   - findRxNormConceptForDrug() returns null (via getMappingsForEntity).
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { OntologyDisabled, OntologyNotFound } from '../errors';
import { ensureConcept } from '../lazyUpsert';
import { mapEntityToConcept } from '../mapping';
import type { OntologyConcept, OntologyMapping } from '@prisma/client';

export const FORMULARY_DRUG_ENTITY_TYPE = 'formulary_drug';
export const FORMULARY_DRUG_RXNORM_SYSTEM = 'RXNORM' as const;

export type MapFormularyDrugResult =
  | { skipped: true; reason: 'no_rxnorm_code' | 'drug_not_found' }
  | { skipped: false; mapping: OntologyMapping; concept: OntologyConcept };

/**
 * Wire a single FormularyDrug row to its RxNorm OntologyConcept.
 *
 * Behavior:
 *   1. Loads the drug row and reads its rxNorm field.
 *   2. If rxNorm is null/empty → returns { skipped: true, reason: 'no_rxnorm_code' }.
 *   3. Otherwise calls ensureConcept({ RXNORM, code: rxNorm, displayHint: drug.genericName }).
 *   4. Calls mapEntityToConcept with source = 'inferred'. Idempotent: a re-run
 *      updates the existing mapping in place.
 *
 * @throws OntologyDisabled when FF_ONTOLOGY_ENABLED is OFF.
 * @throws OntologyNotFound when the RXNORM code system is not seeded.
 */
export async function mapFormularyDrugToRxNorm(
  drugId: string,
): Promise<MapFormularyDrugResult> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) throw new OntologyDisabled();

  const drug = await prisma.formularyDrug.findUnique({
    where: { id: drugId },
    select: { id: true, tenantId: true, rxNorm: true, genericName: true },
  });

  if (!drug) {
    return { skipped: true, reason: 'drug_not_found' };
  }

  const rxNormCode = drug.rxNorm?.trim();
  if (!rxNormCode) {
    return { skipped: true, reason: 'no_rxnorm_code' };
  }

  const concept = await ensureConcept({
    codeSystem: FORMULARY_DRUG_RXNORM_SYSTEM,
    code: rxNormCode,
    tenantId: drug.tenantId,
    displayHint: drug.genericName,
  });

  const mapping = await mapEntityToConcept({
    tenantId: drug.tenantId,
    entityType: FORMULARY_DRUG_ENTITY_TYPE,
    entityId: drug.id,
    conceptId: concept.id,
    mappingType: 'primary',
    source: 'inferred',
  });

  return { skipped: false, mapping, concept };
}

/**
 * Read-only lookup: return the linked RxNorm OntologyConcept for the drug, or
 * null if no mapping exists. Tenant-scoped (the mapping's tenantId must match
 * the drug's tenantId — enforced by the entity-type/entity-id index).
 *
 * Returns null when FF_ONTOLOGY_ENABLED is OFF, when the drug does not exist,
 * or when no mapping has been created yet.
 */
export async function findRxNormConceptForDrug(
  drugId: string,
): Promise<OntologyConcept | null> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) return null;

  const drug = await prisma.formularyDrug.findUnique({
    where: { id: drugId },
    select: { id: true, tenantId: true },
  });
  if (!drug) return null;

  const system = await prisma.ontologyCodeSystem.findUnique({
    where: { code: FORMULARY_DRUG_RXNORM_SYSTEM },
    select: { id: true },
  });
  if (!system) {
    throw new OntologyNotFound(`OntologyCodeSystem '${FORMULARY_DRUG_RXNORM_SYSTEM}' is not seeded`);
  }

  const mapping = await prisma.ontologyMapping.findFirst({
    where: {
      tenantId: drug.tenantId,
      entityType: FORMULARY_DRUG_ENTITY_TYPE,
      entityId: drug.id,
      concept: { codeSystemId: system.id },
    },
    include: { concept: true },
    orderBy: { createdAt: 'asc' },
  });

  return mapping?.concept ?? null;
}
