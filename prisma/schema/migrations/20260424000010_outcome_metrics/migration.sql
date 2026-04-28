-- Phase 6.3 — Outcome Metrics Framework
-- Additive only: no DROP, RENAME TABLE, TRUNCATE, or DELETE FROM.
-- Not applied automatically — run `npx prisma migrate deploy` when ready.
-- See NOTES.md §Phase 6.3 for the deployment runbook.

-- OutcomeDefinition: declarative registry of outcome keys
CREATE TABLE IF NOT EXISTS outcome_definitions (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  key              TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  unit             TEXT        NOT NULL,
  direction        TEXT        NOT NULL,  -- 'higher_is_better' | 'lower_is_better' | 'target'
  target           FLOAT,
  target_tolerance FLOAT,
  formula          JSONB       NOT NULL,
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outcome_definitions_pkey       PRIMARY KEY (id),
  CONSTRAINT outcome_definitions_key_unique UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS outcome_definitions_key_idx
  ON outcome_definitions (key);

CREATE INDEX IF NOT EXISTS outcome_definitions_status_idx
  ON outcome_definitions (status);

-- OutcomeMeasurement: one row per (outcome, tenant, period, dimension slice)
-- dimensionsHash = sha256(canonical JSON(dimensions)) — enforces uniqueness
-- over the opaque JSONB dimensions column.
CREATE TABLE IF NOT EXISTS outcome_measurements (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  outcome_key         TEXT        NOT NULL,
  tenant_id           UUID        NOT NULL,
  period_start        TIMESTAMPTZ NOT NULL,
  period_end          TIMESTAMPTZ NOT NULL,
  period_granularity  TEXT        NOT NULL,  -- 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
  dimensions          JSONB       NOT NULL DEFAULT '{}',
  dimensions_hash     TEXT        NOT NULL,
  value               FLOAT       NOT NULL,
  sample_size         INT         NOT NULL DEFAULT 0,
  computed_at         TIMESTAMPTZ NOT NULL,
  CONSTRAINT outcome_measurements_pkey PRIMARY KEY (id),
  CONSTRAINT outcome_measurements_unique
    UNIQUE (outcome_key, tenant_id, period_start, period_granularity, dimensions_hash),
  CONSTRAINT outcome_measurements_outcome_key_fkey
    FOREIGN KEY (outcome_key) REFERENCES outcome_definitions (key)
    ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS outcome_measurements_key_tenant_period_idx
  ON outcome_measurements (outcome_key, tenant_id, period_start);

CREATE INDEX IF NOT EXISTS outcome_measurements_tenant_idx
  ON outcome_measurements (tenant_id);
