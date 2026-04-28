// =============================================================================
// Phase 5.3 — Ontology seed helper
//
// Loads fixtures/minimal-seed.json into OntologyCodeSystem + OntologyConcept.
// Intended ONLY for tests. Never call this from application code.
//
// All operations are upserts so the function is idempotent — calling it
// multiple times in a test suite produces the same state.
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import { ONTOLOGY_GLOBAL_TENANT_ID } from './constants';
import seedData from './fixtures/minimal-seed.json';

interface SeedResult {
  codeSystems: number;
  concepts: number;
}

/**
 * Seed the four OntologyCodeSystem rows and ~20 OntologyConcept rows.
 *
 * @param prisma     - A PrismaClient (or Prisma tx) instance.
 * @param tenantId   - The tenantId to assign to seeded concepts.
 *                     Defaults to ONTOLOGY_GLOBAL_TENANT_ID.
 */
export async function seedOntologyFixtures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  tenantId: string = ONTOLOGY_GLOBAL_TENANT_ID,
): Promise<SeedResult> {
  // Upsert code systems.
  const systemIdMap: Record<string, string> = {};
  for (const cs of seedData.codeSystems) {
    const row = await (prisma as PrismaClient).ontologyCodeSystem.upsert({
      where: { code: cs.code },
      create: {
        code: cs.code,
        name: cs.name,
        version: cs.version,
        url: cs.url,
        description: cs.description,
      },
      update: {
        name: cs.name,
        version: cs.version,
        url: cs.url,
        description: cs.description,
      },
    });
    systemIdMap[cs.code] = row.id;
  }

  // Upsert concepts.
  let conceptCount = 0;
  for (const c of seedData.concepts) {
    const codeSystemId = systemIdMap[c.codeSystem];
    if (!codeSystemId) continue;

    const existing = await (prisma as PrismaClient).ontologyConcept.findFirst({
      where: { codeSystemId, code: c.code, tenantId },
      select: { id: true },
    });

    if (existing) {
      await (prisma as PrismaClient).ontologyConcept.update({
        where: { id: existing.id },
        data: {
          display: c.display,
          displayAr: c.displayAr ?? null,
          semanticType: c.semanticType ?? null,
          status: 'active',
        },
      });
    } else {
      await (prisma as PrismaClient).ontologyConcept.create({
        data: {
          tenantId,
          codeSystemId,
          code: c.code,
          display: c.display,
          displayAr: c.displayAr ?? null,
          semanticType: c.semanticType ?? null,
          status: 'active',
        },
      });
    }
    conceptCount++;
  }

  return { codeSystems: seedData.codeSystems.length, concepts: conceptCount };
}
