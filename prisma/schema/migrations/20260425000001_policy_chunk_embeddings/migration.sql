-- Phase 7.1 — SAM PolicyChunk pgvector embeddings (additive only)
-- Reuses Phase 5.2's pgvector extension and HNSW pattern.
-- DO NOT apply until FF_EMBEDDINGS_ENABLED rollout is planned (shared flag with Phase 5.2).
-- Safe to run multiple times (all statements are IF NOT EXISTS / idempotent).

-- 1. Ensure pgvector is enabled (idempotent — already enabled by 20260424000008
--    when applied; redundant CREATE EXTENSION IF NOT EXISTS is a no-op).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the vector column to policy_chunks.
--    Named "embeddingVec" to avoid colliding with the existing "embedding" JSONB
--    column from the baseline schema (which is currently dead code but cannot be
--    dropped under the additive-only invariant). NULL until backfill runs.
ALTER TABLE "policy_chunks"
  ADD COLUMN IF NOT EXISTS "embeddingVec" vector(1536);

-- 3. HNSW index for fast approximate cosine-similarity search, mirroring the
--    Phase 5.2 pattern on core_departments.
CREATE INDEX IF NOT EXISTS "policy_chunks_embeddingVec_hnsw_idx"
  ON "policy_chunks"
  USING hnsw ("embeddingVec" vector_cosine_ops);
