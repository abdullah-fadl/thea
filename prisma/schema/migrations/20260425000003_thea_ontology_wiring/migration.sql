-- =============================================================================
-- Phase 7.3 — Thea Health ontology wiring (additive)
--
-- Two changes, both additive:
--   1. Extend the OntologyMappingSource enum with 'inferred' (used by the
--      lazy-upsert pattern in lib/ontology/lazyUpsert.ts; mappings created
--      from existing internal codes when the licensed concept dataset has
--      not been imported yet).
--   2. Add FormularyDrug.rxNorm as a nullable text column. Existing rows are
--      unaffected (NULL by default); rows without an rxNorm code are skipped
--      by the FormularyDrug → RXNORM wiring helper.
--
-- No DROP / RENAME / TRUNCATE. No data backfill in this migration — the
-- backfill is a separate one-shot script (scripts/backfill-formulary-drug-
-- ontology.ts) run AFTER the migration is applied and the flag is enabled.
-- =============================================================================

-- ─── 1. OntologyMappingSource enum: add 'inferred' ────────────────────────────
ALTER TYPE "OntologyMappingSource" ADD VALUE IF NOT EXISTS 'inferred';

-- ─── 2. FormularyDrug.rxNorm nullable text column ─────────────────────────────
ALTER TABLE "formulary_drugs"
  ADD COLUMN IF NOT EXISTS "rxNorm" TEXT;
