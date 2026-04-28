// =============================================================================
// Phase 7.3 — Lazy concept upsert
//
// Why this exists:
//   Phase 5.3 deliberately deferred bulk import of SNOMED CT / LOINC / ICD-10-AM
//   / RxNorm datasets because of licensing requirements. But Thea Health
//   already has internal codes (FormularyDrug.rxNorm, DiagnosisCatalog.icd10)
//   on existing rows that we want wired into the ontology graph today so AI
//   agents and clinical decision support can traverse the link.
//
//   The lazy-upsert pattern bridges that gap:
//     1. When a wiring helper needs an OntologyConcept for a (codeSystem, code)
//        pair that has not been imported yet, ensureConcept() creates a stub
//        concept with display = code (placeholder) and tenantId = global.
//     2. The OntologyMapping that points at the stub is created with
//        source = 'inferred' so we can distinguish lazy mappings from
//        manually curated or AI-suggested ones.
//     3. When the licensed dataset is later imported via
//        scripts/import-ontology.ts, the existing stub row is enriched
//        in-place (display, displayAr, semanticType, status). The (codeSystem,
//        code, tenantId) unique key stays stable, so the OntologyMapping rows
//        survive the enrichment intact — no remapping required.
//
// Flag gating:
//   ensureConcept() throws OntologyDisabled if FF_ONTOLOGY_ENABLED is OFF.
//   Concurrent calls are safe: the (codeSystemId, code, tenantId) unique
//   constraint plus an upsert-by-find-then-create-with-rescue guarantees
//   idempotency.
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { OntologyDisabled, OntologyNotFound } from './errors';
import { ONTOLOGY_GLOBAL_TENANT_ID, ONTOLOGY_SYSTEMS, type OntologySystem } from './constants';
import type { OntologyConcept } from '@prisma/client';

export interface EnsureConceptArgs {
  codeSystem: OntologySystem;
  code: string;
  tenantId?: string;
  /** Optional human-readable label used when creating a stub. Defaults to `code`. */
  displayHint?: string;
}

/**
 * Find or lazily create an OntologyConcept for the given (codeSystem, code,
 * tenantId). When the concept does not yet exist, a stub row is inserted with
 * display = displayHint ?? code and status = 'active'.
 *
 * Idempotent: a second call with the same arguments returns the same row.
 * Concurrent calls race-safely fall back to the existing row on unique-key
 * violation.
 *
 * @throws OntologyDisabled when FF_ONTOLOGY_ENABLED is OFF.
 * @throws OntologyNotFound when the OntologyCodeSystem row for `codeSystem`
 *         is missing (i.e. the migration was applied but the seed step was
 *         skipped — see lib/ontology/seed.ts and scripts/import-ontology.ts).
 * @throws Error when codeSystem is not one of ONTOLOGY_SYSTEMS.
 */
export async function ensureConcept(args: EnsureConceptArgs): Promise<OntologyConcept> {
  if (!isEnabled('FF_ONTOLOGY_ENABLED')) throw new OntologyDisabled();

  const { codeSystem, code, tenantId = ONTOLOGY_GLOBAL_TENANT_ID, displayHint } = args;

  if (!ONTOLOGY_SYSTEMS.includes(codeSystem)) {
    throw new Error(`Unknown codeSystem: ${codeSystem}`);
  }
  if (!code || code.trim().length === 0) {
    throw new Error('ensureConcept: code is required');
  }

  const system = await prisma.ontologyCodeSystem.findUnique({
    where: { code: codeSystem },
    select: { id: true },
  });
  if (!system) {
    throw new OntologyNotFound(`OntologyCodeSystem '${codeSystem}' is not seeded`);
  }

  const existing = await prisma.ontologyConcept.findFirst({
    where: { codeSystemId: system.id, code, tenantId },
  });
  if (existing) return existing;

  // Race-safe insert: on unique-key violation (P2002), re-read the winner.
  try {
    return await prisma.ontologyConcept.create({
      data: {
        tenantId,
        codeSystemId: system.id,
        code,
        display: displayHint ?? code,
        displayAr: null,
        semanticType: null,
        status: 'active',
      },
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      const winner = await prisma.ontologyConcept.findFirst({
        where: { codeSystemId: system.id, code, tenantId },
      });
      if (winner) return winner;
    }
    throw err;
  }
}
