// =============================================================================
// Phase 7.2 — Imdad ItemMaster semantic search
//
// searchImdadItemMastersByText(query, tenantId, limit) embeds the query text
// via the shared default provider, then runs an HNSW cosine-similarity search
// over imdad_item_masters scoped to the given tenant.
//
// Returns [] when FF_EMBEDDINGS_ENABLED is OFF (silent degradation, callers
// work identically in both flag states).
//
// Each hit includes the item `code` since procurement matches items by code.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { getDefaultProvider, EmbeddingsDisabled } from '../provider';

export interface ImdadItemMasterSearchResult {
  id: string;
  name: string;
  code: string;
  similarity: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface SearchImdadItemMastersOptions {
  prismaClient?: AnyPrisma;
}

/**
 * Semantic search over ImdadItemMaster rows for a given tenant.
 *
 * Returns up to `limit` results ordered by cosine similarity (descending).
 * Returns [] when FF_EMBEDDINGS_ENABLED is OFF.
 */
export async function searchImdadItemMastersByText(
  query: string,
  tenantId: string,
  limit = 10,
  opts?: SearchImdadItemMastersOptions,
): Promise<ImdadItemMasterSearchResult[]> {
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
    name: string;
    code: string;
    similarity: number;
  };

  // pgvector <=> operator is cosine distance (0 = identical, 2 = opposite).
  // similarity = 1 - distance for intuitive DESC ordering.
  // Tenant scoping is mandatory: WHERE "tenantId" = $2 cannot be removed.
  const rows = (await db.$queryRawUnsafe(
    `
    SELECT
      "id",
      "name",
      "code",
      1 - ("embeddingVec" <=> $1::vector) AS similarity
    FROM "imdad_item_masters"
    WHERE "tenantId" = $2::uuid
      AND "embeddingVec" IS NOT NULL
      AND "isDeleted" = false
    ORDER BY "embeddingVec" <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    tenantId,
    limit,
  )) as RawRow[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    similarity: Number(r.similarity),
  }));
}
