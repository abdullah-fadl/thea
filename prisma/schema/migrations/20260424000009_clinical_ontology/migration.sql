-- Phase 5.3 — Clinical ontology mapping layer (additive only)
-- Prerequisite: migration 20260424000008_pgvector_embeddings applied.
-- Safe to run multiple times (all statements are IF NOT EXISTS / idempotent).
-- DO NOT apply until FF_ONTOLOGY_ENABLED flip is planned.
-- No licensed terminology data is loaded here — see scripts/import-ontology.ts.

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "OntologyConceptStatus" AS ENUM ('active', 'deprecated', 'retired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OntologyMappingType" AS ENUM ('primary', 'additional', 'billing', 'deprecated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OntologyMappingSource" AS ENUM ('manual', 'ai', 'imported');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── 1. OntologyCodeSystem ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ontology_code_systems" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "code"        TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "version"     TEXT         NOT NULL,
  "url"         TEXT         NOT NULL,
  "description" TEXT,
  "addedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "ontology_code_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ontology_code_systems_code_key"
  ON "ontology_code_systems" ("code");

-- ─── 2. OntologyConcept ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ontology_concepts" (
  "id"           UUID                    NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"     UUID                    NOT NULL,
  "codeSystemId" UUID                    NOT NULL,
  "code"         TEXT                    NOT NULL,
  "display"      TEXT                    NOT NULL,
  "displayAr"    TEXT,
  "semanticType" TEXT,
  "status"       "OntologyConceptStatus" NOT NULL DEFAULT 'active',
  "createdAt"    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  CONSTRAINT "ontology_concepts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ontology_concepts_codeSystemId_fkey"
    FOREIGN KEY ("codeSystemId")
    REFERENCES "ontology_code_systems" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Unique: one code per system per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "ontology_concepts_codeSystemId_code_tenantId_key"
  ON "ontology_concepts" ("codeSystemId", "code", "tenantId");

-- Query index: lookups by tenant + system
CREATE INDEX IF NOT EXISTS "ontology_concepts_tenantId_codeSystemId_idx"
  ON "ontology_concepts" ("tenantId", "codeSystemId");

-- ─── 3. OntologyMapping ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ontology_mappings" (
  "id"          UUID                    NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    UUID                    NOT NULL,
  "entityType"  TEXT                    NOT NULL,
  "entityId"    TEXT                    NOT NULL,
  "conceptId"   UUID                    NOT NULL,
  "mappingType" "OntologyMappingType"   NOT NULL DEFAULT 'primary',
  "confidence"  DOUBLE PRECISION        NOT NULL DEFAULT 1.0,
  "source"      "OntologyMappingSource" NOT NULL DEFAULT 'manual',
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  CONSTRAINT "ontology_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ontology_mappings_conceptId_fkey"
    FOREIGN KEY ("conceptId")
    REFERENCES "ontology_concepts" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Query index: resolve all mappings for a given entity
CREATE INDEX IF NOT EXISTS "ontology_mappings_tenantId_entityType_entityId_idx"
  ON "ontology_mappings" ("tenantId", "entityType", "entityId");

-- Query index: reverse lookup — which entities use a concept?
CREATE INDEX IF NOT EXISTS "ontology_mappings_conceptId_idx"
  ON "ontology_mappings" ("conceptId");

-- ─── 4. Trigger: auto-update updatedAt ───────────────────────────────────────
-- Reuse or create a generic trigger function if not present.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER "ontology_concepts_updated_at"
    BEFORE UPDATE ON "ontology_concepts"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER "ontology_mappings_updated_at"
    BEFORE UPDATE ON "ontology_mappings"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;
