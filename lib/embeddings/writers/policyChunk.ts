// =============================================================================
// Phase 7.1 — SAM PolicyChunk embedding writer
//
// embedPolicyChunk(id, opts?) fetches the chunk by id, embeds the `content`
// text via the shared default provider, then stores the vector in the new
// "embeddingVec" column with a raw UPDATE.
//
// Idempotent: re-running on the same row overwrites with an identical vector
// (deterministic model + identical input).
//
// Reuses Phase 5.2's EmbeddingsProvider — does NOT introduce a new flag or a
// new provider implementation.
//
// PolicyChunk content is regulatory/compliance text intended for retrieval.
// It is not PHI, but it IS tenant-scoped and may be tenant-confidential —
// callers must NOT cross-tenant the search results.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { getDefaultProvider } from '../provider';

export interface EmbedPolicyChunkResult {
  id: string;
  model: string;
  totalTokens: number;
  skipped: false;
}

export interface EmbedPolicyChunkSkipped {
  id: string;
  reason: string;
  skipped: true;
}

export type EmbedPolicyChunkOutcome =
  | EmbedPolicyChunkResult
  | EmbedPolicyChunkSkipped;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface EmbedPolicyChunkOptions {
  /** Inject a different PrismaClient (useful for scripts with a direct connection). */
  prismaClient?: AnyPrisma;
}

/**
 * Generate and persist an embedding for a single PolicyChunk row.
 *
 * Returns skipped:true when the flag is OFF or the chunk does not exist /
 * has empty content. Throws on unexpected errors (e.g. provider failures).
 */
export async function embedPolicyChunk(
  id: string,
  opts?: EmbedPolicyChunkOptions,
): Promise<EmbedPolicyChunkOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  if (!isEnabled('FF_EMBEDDINGS_ENABLED')) {
    return { id, reason: 'FF_EMBEDDINGS_ENABLED is OFF', skipped: true };
  }

  // May throw EmbeddingsConfigurationError when key is missing — let it propagate.
  const provider = getDefaultProvider();

  const chunk = await db.policyChunk.findUnique({
    where: { id },
    select: { id: true, content: true },
  });

  if (!chunk) {
    return { id, reason: 'policy chunk not found', skipped: true };
  }

  const content = (chunk as { content: string }).content;
  if (!content || content.trim().length === 0) {
    return { id, reason: 'policy chunk has empty content', skipped: true };
  }

  const result = await provider.embed(content);

  // Raw UPDATE — Prisma does not natively support vector(1536). Column name is
  // quoted camelCase ("embeddingVec") to match this codebase's column naming
  // convention for policy_chunks (see baseline migration).
  const vectorLiteral = `[${result.embedding.join(',')}]`;
  await db.$executeRawUnsafe(
    `UPDATE "policy_chunks" SET "embeddingVec" = $1::vector WHERE "id" = $2::uuid`,
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
