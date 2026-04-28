// =============================================================================
// Phase 7.1 — SAM PolicyChunk semantic search
//
// searchPolicyChunksByText(query, tenantId, limit) embeds the query text via
// the shared default provider, then runs an HNSW cosine-similarity search
// over policy_chunks scoped to the given tenant.
//
// Returns [] when FF_EMBEDDINGS_ENABLED is OFF (silent degradation, callers
// work identically in both flag states).
//
// Each hit includes the parent PolicyDocument id ("documentId") so callers
// can navigate up to title / metadata. Content is truncated to 200 chars to
// keep results compact in transport.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { getDefaultProvider, EmbeddingsDisabled } from '../provider';

export interface PolicyChunkSearchResult {
  id: string;
  policyDocumentId: string;
  content: string;
  similarity: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface SearchPolicyChunksOptions {
  prismaClient?: AnyPrisma;
}

const CONTENT_PREVIEW_CHARS = 200;

/**
 * Semantic search over PolicyChunk rows for a given tenant.
 *
 * Returns up to `limit` results ordered by cosine similarity (descending).
 * Returns [] when FF_EMBEDDINGS_ENABLED is OFF.
 */
export async function searchPolicyChunksByText(
  query: string,
  tenantId: string,
  limit = 10,
  opts?: SearchPolicyChunksOptions,
): Promise<PolicyChunkSearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  let provider;
  try {
    provider = getDefaultProvider();
  } catch (err) {
    if (err instanceof EmbeddingsDisabled) return [];
    throw err;
  }

  let queryEmbedding: number[];
  try {
    const result = await provider.embed(query);
    queryEmbedding = result.embedding;
  } catch (err) {
    if (err instanceof EmbeddingsDisabled) return [];
    throw err;
  }

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  type RawRow = {
    id: string;
    documentId: string;
    content: string;
    similarity: number;
  };

  // pgvector <=> operator is cosine distance (0 = identical, 2 = opposite).
  // similarity = 1 - distance for intuitive DESC ordering.
  // Tenant scoping is mandatory: WHERE "tenantId" = $2 cannot be removed.
  const rows = (await db.$queryRawUnsafe(
    `
    SELECT
      "id",
      "documentId",
      "content",
      1 - ("embeddingVec" <=> $1::vector) AS similarity
    FROM "policy_chunks"
    WHERE "tenantId" = $2::uuid
      AND "embeddingVec" IS NOT NULL
    ORDER BY "embeddingVec" <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    tenantId,
    limit,
  )) as RawRow[];

  return rows.map((r) => ({
    id: r.id,
    policyDocumentId: r.documentId,
    content:
      r.content.length > CONTENT_PREVIEW_CHARS
        ? r.content.slice(0, CONTENT_PREVIEW_CHARS) + '…'
        : r.content,
    similarity: Number(r.similarity),
  }));
}
