// =============================================================================
// Phase 5.3 — Ontology lookup API
//
// All functions are guarded by FF_ONTOLOGY_ENABLED:
//   OFF → findConceptByCode returns null, findConceptsByDisplay returns [],
//         getMappingsForEntity returns [].
//   ON  → queries OntologyConcept / OntologyMapping tables via Prisma.
//
// Tenant scoping:
//   findConceptByCode / findConceptsByDisplay search the caller's tenantId
//   UNION ONTOLOGY_GLOBAL_TENANT_ID so global concepts are always visible.
//
// Text search strategy:
//   Uses ILIKE for broad compatibility. If pg_trgm is installed on the target
//   DB, add a GIN index on "display" for faster LIKE queries (not required
//   for correctness).
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { ONTOLOGY_GLOBAL_TENANT_ID, type OntologySystem } from './constants';
import type { OntologyConcept, OntologyMapping } from '@prisma/client';

export type { OntologyConcept, OntologyMapping };

// ─── findConceptByCode ────────────────────────────────────────────────────────

/**
 * Look up a single concept by its exact external code.
 *
 * Searches the caller's tenantId first, then falls back to global concepts
 * (ONTOLOGY_GLOBAL_TENANT_ID).  Returns null if FF_ONTOLOGY_ENABLED is OFF
 * or no matching concept exists.
 *
 * @param codeSystem  - One of the four supported terminology systems.
 * @param code        - The external system's canonical code.
 * @param tenantId    - Caller's tenantId (defaults to global-only search).
 */
export async function findConceptByCode(
  codeSystem: OntologySystem,
  code: string,
  tenantId: string = ONTOLOGY_GLOBAL_TENANT_ID,
): Promise<OntologyConcept | null> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) return null;

  const system = await prisma.ontologyCodeSystem.findUnique({
    where: { code: codeSystem },
    select: { id: true },
  });
  if (!system) return null;

  // Prefer tenant-specific concept; fall back to global.
  return prisma.ontologyConcept.findFirst({
    where: {
      codeSystemId: system.id,
      code,
      tenantId: { in: [tenantId, ONTOLOGY_GLOBAL_TENANT_ID] },
      status: 'active',
    },
    orderBy: [
      // Tenant-specific rows sort before global rows.
      { tenantId: 'desc' },
    ],
  });
}

// ─── findConceptsByDisplay ────────────────────────────────────────────────────

/**
 * Full-text search across concept display names (English).
 *
 * Uses ILIKE for compatibility. Returns up to `limit` results (default 20).
 * Searches the caller's tenantId plus global concepts.
 *
 * @param display     - Partial or full English display name to search.
 * @param codeSystem  - Optional filter to a single code system.
 * @param tenantId    - Caller's tenantId (defaults to global-only search).
 * @param limit       - Max results to return (default 20, max 100).
 */
export async function findConceptsByDisplay(
  display: string,
  codeSystem?: OntologySystem,
  tenantId: string = ONTOLOGY_GLOBAL_TENANT_ID,
  limit = 20,
): Promise<OntologyConcept[]> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) return [];

  const effectiveLimit = Math.min(limit, 100);

  let codeSystemId: string | undefined;
  if (codeSystem) {
    const system = await prisma.ontologyCodeSystem.findUnique({
      where: { code: codeSystem },
      select: { id: true },
    });
    if (!system) return [];
    codeSystemId = system.id;
  }

  return prisma.ontologyConcept.findMany({
    where: {
      display: { contains: display, mode: 'insensitive' },
      tenantId: { in: [tenantId, ONTOLOGY_GLOBAL_TENANT_ID] },
      status: 'active',
      ...(codeSystemId ? { codeSystemId } : {}),
    },
    orderBy: { display: 'asc' },
    take: effectiveLimit,
  });
}

// ─── getMappingsForEntity ─────────────────────────────────────────────────────

/**
 * Retrieve all concept mappings attached to a specific Thea entity.
 *
 * Returns the OntologyConcept records (not the mapping join rows) for
 * convenience.  Returns [] if FF_ONTOLOGY_ENABLED is OFF.
 *
 * @param entityType - e.g. "core_department", "encounter", "lab_order".
 * @param entityId   - The entity's primary key string.
 * @param tenantId   - Caller's tenantId for row-level isolation.
 */
export async function getMappingsForEntity(
  entityType: string,
  entityId: string,
  tenantId: string,
): Promise<OntologyConcept[]> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) return [];

  const mappings = await prisma.ontologyMapping.findMany({
    where: { tenantId, entityType, entityId },
    include: { concept: true },
    orderBy: { createdAt: 'asc' },
  });

  return mappings.map((m) => m.concept);
}
