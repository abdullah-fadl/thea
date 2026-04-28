// =============================================================================
// Phase 5.2 — CoreDepartment semantic search
//
// searchCoreDepartmentsByText(query, tenantId, limit) embeds the query text,
// then runs an HNSW cosine-similarity search scoped to the given tenant.
// Results are sorted by descending similarity (most similar first).
//
// Returns [] when FF_EMBEDDINGS_ENABLED is OFF (no error thrown, silent
// degradation so callers work identically in both flag states).
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { getDefaultProvider, EmbeddingsDisabled } from '../provider';

export interface DepartmentSearchResult {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string | null;
  similarity: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface SearchCoreDepartmentsOptions {
  prismaClient?: AnyPrisma;
}

/**
 * Semantic search over CoreDepartment rows for a given tenant.
 *
 * Returns up to `limit` results ordered by cosine similarity (descending).
 * Returns an empty array when FF_EMBEDDINGS_ENABLED is OFF.
 */
export async function searchCoreDepartmentsByText(
  query: string,
  tenantId: string,
  limit = 10,
  opts?: SearchCoreDepartmentsOptions,
): Promise<DepartmentSearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  let provider;
  try {
    provider = getDefaultProvider();
  } catch (err) {
    if (err instanceof EmbeddingsDisabled) return [];
    throw err;
  }

  // Try embedding; if disabled, return empty.
  let queryEmbedding: number[];
  try {
    const result = await provider.embed(query);
    queryEmbedding = result.embedding;
  } catch (err) {
    if (err instanceof EmbeddingsDisabled) return [];
    throw err;
  }

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  // pgvector <=> operator = cosine distance (0 = identical, 2 = opposite).
  // We convert to similarity = 1 - distance for intuitive DESC ordering.
  type RawRow = {
    id: string;
    tenant_id: string;
    name: string;
    name_ar: string | null;
    similarity: number;
  };

  const rows = await db.$queryRawUnsafe(
    `
    SELECT
      id,
      tenant_id,
      name,
      name_ar,
      1 - (embedding <=> $1::vector) AS similarity
    FROM core_departments
    WHERE tenant_id = $2::uuid
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    tenantId,
    limit,
  );

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    nameAr: r.name_ar,
    similarity: Number(r.similarity),
  }));
}
