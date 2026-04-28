-- Phase 4.2 — Append-only domain event log
-- Additive migration only. No DROP, RENAME, or TRUNCATE.
--
-- The `events` table is the persistence layer for the platform event bus
-- (lib/events/emit.ts).  It is separate from `audit_logs` which records
-- access-control events.  See lib/events/README for the full design.
--
-- Deployment note:
--   Apply this migration before setting THEA_FF_EVENT_BUS_ENABLED=true.
--   When the flag is OFF, emit() is a no-op and this table is never touched.

CREATE TABLE IF NOT EXISTS "events" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    UUID         NOT NULL,
  "eventName"   TEXT         NOT NULL,
  "version"     INTEGER      NOT NULL,
  "aggregate"   TEXT         NOT NULL,
  "aggregateId" TEXT         NOT NULL,
  "payload"     JSONB        NOT NULL,
  "metadata"    JSONB,
  "emittedAt"   TIMESTAMPTZ  NOT NULL,
  "sequence"    BIGSERIAL    NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- Covering indexes for the primary query patterns:
--   1. Fan-out by tenant (all events for a tenant)
--   2. Filter by event type across tenants (schema registry lookups)
--   3. Replay by entity  (all events for a specific aggregate instance)
--   4. Time-range replay (audit window)
CREATE INDEX IF NOT EXISTS "events_tenantId_idx"
  ON "events" ("tenantId");

CREATE INDEX IF NOT EXISTS "events_eventName_idx"
  ON "events" ("eventName");

CREATE INDEX IF NOT EXISTS "events_tenantId_aggregate_aggregateId_idx"
  ON "events" ("tenantId", "aggregate", "aggregateId");

CREATE INDEX IF NOT EXISTS "events_tenantId_emittedAt_idx"
  ON "events" ("tenantId", "emittedAt");

-- FK to tenants — RESTRICT prevents orphan event rows if a tenant is deleted.
-- Tenant deletion must drain/archive events first (operational concern, not enforced here).
ALTER TABLE "events"
  ADD CONSTRAINT "events_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
