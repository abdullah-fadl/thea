// =============================================================================
// Phase 5.3 — Ontology mapping write API
//
// All functions throw OntologyDisabled when FF_ONTOLOGY_ENABLED is OFF.
// No unvalidated writes — all inputs are typed; conceptId must reference an
// existing OntologyConcept row (FK enforced at DB level).
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { OntologyDisabled } from './errors';
import type { OntologyMapping, OntologyMappingType, OntologyMappingSource } from '@prisma/client';

export type { OntologyMapping };

// ─── mapEntityToConcept ───────────────────────────────────────────────────────

export interface MapEntityToConceptArgs {
  tenantId: string;
  entityType: string;
  entityId: string;
  conceptId: string;
  mappingType?: OntologyMappingType;
  /** 1.0 = confirmed; < 1.0 = AI-suggested confidence. */
  confidence?: number;
  source?: OntologyMappingSource;
  /** userId or system identifier that created the mapping. */
  createdBy?: string;
}

/**
 * Create or update the mapping between a Thea entity and an ontology concept.
 *
 * Idempotent: if a mapping for the same (tenantId, entityType, entityId,
 * conceptId) already exists, it is updated with the new metadata.
 * Throws OntologyDisabled if FF_ONTOLOGY_ENABLED is OFF.
 */
export async function mapEntityToConcept(
  args: MapEntityToConceptArgs,
): Promise<OntologyMapping> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) throw new OntologyDisabled();

  const {
    tenantId,
    entityType,
    entityId,
    conceptId,
    mappingType = 'primary',
    confidence = 1.0,
    source = 'manual',
    createdBy,
  } = args;

  // Upsert on (tenantId, entityType, entityId, conceptId) uniqueness.
  // We treat that combination as the natural key even though there's no DB
  // unique constraint on it — a second call with the same 4-tuple updates.
  const existing = await prisma.ontologyMapping.findFirst({
    where: { tenantId, entityType, entityId, conceptId },
  });

  if (existing) {
    return prisma.ontologyMapping.update({
      where: { id: existing.id },
      data: { mappingType, confidence, source, createdBy },
    });
  }

  return prisma.ontologyMapping.create({
    data: {
      tenantId,
      entityType,
      entityId,
      conceptId,
      mappingType,
      confidence,
      source,
      createdBy,
    },
  });
}

// ─── unmapEntityFromConcept ───────────────────────────────────────────────────

export interface UnmapEntityFromConceptArgs {
  tenantId: string;
  entityType: string;
  entityId: string;
  conceptId: string;
}

/**
 * Remove the mapping between a Thea entity and an ontology concept.
 *
 * No-op if the mapping does not exist.
 * Throws OntologyDisabled if FF_ONTOLOGY_ENABLED is OFF.
 */
export async function unmapEntityFromConcept(
  args: UnmapEntityFromConceptArgs,
): Promise<void> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) throw new OntologyDisabled();

  const { tenantId, entityType, entityId, conceptId } = args;

  const existing = await prisma.ontologyMapping.findFirst({
    where: { tenantId, entityType, entityId, conceptId },
    select: { id: true },
  });

  if (existing) {
    await prisma.ontologyMapping.delete({ where: { id: existing.id } });
  }
}
