-- Phase 7.2 — Imdad ItemMaster + Vendor pgvector embeddings (additive only)
-- Reuses Phase 5.2's pgvector extension and HNSW pattern (same as Phase 7.1).
-- DO NOT apply until FF_EMBEDDINGS_ENABLED rollout is planned (shared flag).
-- Safe to run multiple times (all statements are IF NOT EXISTS / idempotent).

-- 1. Ensure pgvector is enabled (idempotent — already enabled by 20260424000008).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ImdadItemMaster — add embedding column + HNSW index.
--    Drives cross-vendor item equivalence ("find items similar to X"), formulary
--    substitute lookup, and ABC/VED-aware procurement. NULL until backfill runs.
ALTER TABLE "imdad_item_masters"
  ADD COLUMN IF NOT EXISTS "embeddingVec" vector(1536);

CREATE INDEX IF NOT EXISTS "imdad_item_masters_embeddingVec_hnsw_idx"
  ON "imdad_item_masters"
  USING hnsw ("embeddingVec" vector_cosine_ops);

-- 3. ImdadVendor — add embedding column + HNSW index.
--    Powers semantic vendor search (e.g. "saudi medical-equipment supplier with
--    sfda license") and procurement gap analysis. NULL until backfill runs.
ALTER TABLE "imdad_vendors"
  ADD COLUMN IF NOT EXISTS "embeddingVec" vector(1536);

CREATE INDEX IF NOT EXISTS "imdad_vendors_embeddingVec_hnsw_idx"
  ON "imdad_vendors"
  USING hnsw ("embeddingVec" vector_cosine_ops);
