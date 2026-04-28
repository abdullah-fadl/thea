-- Drop the legacy `embedding` JSONB column on policy_chunks.
-- Superseded by `embeddingVec vector(1536)` (added in 20260425000001_policy_chunk_embeddings).
-- Confirmed dead: zero application reads/writes against `embedding` (the JSONB column);
-- all live reads/writes use `embeddingVec` instead.

ALTER TABLE "policy_chunks" DROP COLUMN IF EXISTS "embedding";
