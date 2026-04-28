// =============================================================================
// Phase 5.2 — CoreDepartment embedding writer
//
// embedCoreDepartment(id, opts?) fetches the department by id, builds the
// text corpus (name + nameAr only — no PHI), generates a vector via the
// default provider, then stores it with a raw UPDATE.
//
// Idempotent: calling it twice for the same row overwrites with an identical
// vector (same input → same embedding from a deterministic model).
//
// No PHI is included. Only name, nameAr are embedded.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { getDefaultProvider } from '../provider';

export interface EmbedCoreDepartmentResult {
  id: string;
  model: string;
  totalTokens: number;
  skipped: false;
}

export interface EmbedCoreDepartmentSkipped {
  id: string;
  reason: string;
  skipped: true;
}

export type EmbedCoreDepartmentOutcome =
  | EmbedCoreDepartmentResult
  | EmbedCoreDepartmentSkipped;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface EmbedCoreDepartmentOptions {
  /** Inject a different PrismaClient (useful for scripts with a direct connection). */
  prismaClient?: AnyPrisma;
}

/**
 * Generate and persist an embedding for a single CoreDepartment row.
 *
 * Returns skipped:true when the flag is OFF (EmbeddingsDisabled) or the
 * department does not exist.  Throws on unexpected errors.
 */
export async function embedCoreDepartment(
  id: string,
  opts?: EmbedCoreDepartmentOptions,
): Promise<EmbedCoreDepartmentOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  if (!isEnabled('FF_EMBEDDINGS_ENABLED')) {
    return { id, reason: 'FF_EMBEDDINGS_ENABLED is OFF', skipped: true };
  }

  // May throw EmbeddingsConfigurationError when key is missing — let it propagate.
  const provider = getDefaultProvider();

  const dept = await db.coreDepartment.findUnique({
    where: { id },
    select: { id: true, name: true, nameAr: true },
  });

  if (!dept) {
    return { id, reason: 'department not found', skipped: true };
  }

  const corpus = buildCorpus(dept as { name: string; nameAr: string | null });
  const result = await provider.embed(corpus);

  // Raw UPDATE required — Prisma does not support vector(1536) natively.
  // The vector literal format is '[x,y,...]' which pgvector accepts.
  const vectorLiteral = `[${result.embedding.join(',')}]`;
  await db.$executeRawUnsafe(
    `UPDATE core_departments SET embedding = $1::vector WHERE id = $2::uuid`,
    vectorLiteral,
    id,
  );

  return {
    id,
    model: result.model,
    totalTokens: result.totalTokens,
    skipped: false,
  };
}

function buildCorpus(dept: { name: string; nameAr: string | null }): string {
  const parts = [dept.name];
  if (dept.nameAr) parts.push(dept.nameAr);
  return parts.join(' | ');
}
