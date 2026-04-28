-- Phase 5.2 — pgvector semantic embeddings (additive only)
-- Prerequisite: migration 20260424000007_projection_tables applied.
-- Safe to run multiple times (all statements are IF NOT EXISTS / idempotent).
-- DO NOT apply until FF_EMBEDDINGS_ENABLED flip is planned.

-- 1. Enable the pgvector extension (Postgres 17, no-op if already present).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column to core_departments.
--    NULL until backfill-core-department-embeddings.ts runs for a given row.
--    vector(1536) matches text-embedding-3-large @ dimensions: 1536.
ALTER TABLE core_departments
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. HNSW index for fast approximate cosine-similarity search.
--    Built after column addition; skipped if the index already exists.
CREATE INDEX IF NOT EXISTS core_departments_embedding_hnsw_idx
  ON core_departments
  USING hnsw (embedding vector_cosine_ops);
