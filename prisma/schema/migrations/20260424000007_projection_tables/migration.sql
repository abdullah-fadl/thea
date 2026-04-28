-- Phase 5.1 — Event sourcing projection layer
-- Additive migration only. Zero DROP, RENAME, or TRUNCATE.
--
-- Adds two tables that power the CQRS projection framework (lib/events/projections/).
-- Gated by FF_EVENT_PROJECTIONS_ENABLED (default OFF).
--
-- Deployment note:
--   Apply this migration before setting THEA_FF_EVENT_PROJECTIONS_ENABLED=true.
--   When the flag is OFF these tables exist but are never touched by application code.

-- Enum for projection lifecycle state
DO $$ BEGIN
  CREATE TYPE "ProjectionStatus" AS ENUM ('active', 'rebuilding', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- projection_states: one row per registered projection; tracks the high-water-mark sequence.
CREATE TABLE IF NOT EXISTS "projection_states" (
  "id"                UUID               NOT NULL DEFAULT gen_random_uuid(),
  "name"              TEXT               NOT NULL,
  "lastEventSequence" BIGINT             NOT NULL DEFAULT 0,
  "lastEventTime"     TIMESTAMPTZ,
  "status"            "ProjectionStatus" NOT NULL DEFAULT 'active',
  "errorMessage"      TEXT,
  "createdAt"         TIMESTAMPTZ        NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ        NOT NULL DEFAULT now(),

  CONSTRAINT "projection_states_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "projection_states_name_key" UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "projection_states_name_idx"
  ON "projection_states" ("name");

-- projection_snapshots: periodic state checkpoints that let replay skip already-processed events.
CREATE TABLE IF NOT EXISTS "projection_snapshots" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "projectionName" TEXT        NOT NULL,
  "tenantId"       UUID        NOT NULL,
  "aggregateId"    TEXT        NOT NULL,
  "state"          JSONB       NOT NULL,
  "eventSequence"  BIGINT      NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "projection_snapshots_pkey" PRIMARY KEY ("id")
);

-- Covering index for the primary lookup: latest snapshot for a given projection + aggregate
CREATE INDEX IF NOT EXISTS "projection_snapshots_name_tenant_aggregate_idx"
  ON "projection_snapshots" ("projectionName", "tenantId", "aggregateId");
