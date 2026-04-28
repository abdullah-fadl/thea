-- Phase 6.2 — AI Agents Framework
-- Additive only: no DROP, RENAME TABLE, TRUNCATE, or DELETE FROM.
-- Not applied automatically — run `npx prisma migrate deploy` when ready.
-- See NOTES.md §Phase 6.2 for the deployment runbook.

-- AgentDefinition: declarative registry of registered agents
CREATE TABLE IF NOT EXISTS agent_definitions (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  key                TEXT        NOT NULL,
  name               TEXT        NOT NULL,
  description        TEXT        NOT NULL,
  version            INT         NOT NULL DEFAULT 1,
  input_schema_json  JSONB       NOT NULL,
  output_schema_json JSONB       NOT NULL,
  policy_key         TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT agent_definitions_key_unique UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS agent_definitions_key_idx
  ON agent_definitions (key);

-- AgentRun: every agent invocation
CREATE TABLE IF NOT EXISTS agent_runs (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL,
  agent_key            TEXT        NOT NULL,
  actor_user_id        UUID,
  input_json           JSONB       NOT NULL,
  output_json          JSONB,
  status               TEXT        NOT NULL DEFAULT 'running',
  error_message        TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  duration_ms          INT,
  events_emitted_count INT         NOT NULL DEFAULT 0,
  cedar_decision       TEXT        NOT NULL DEFAULT 'unevaluated',
  cedar_reasons        TEXT[]      NOT NULL DEFAULT '{}',
  CONSTRAINT agent_runs_pkey PRIMARY KEY (id),
  CONSTRAINT agent_runs_agent_key_fkey
    FOREIGN KEY (agent_key) REFERENCES agent_definitions (key)
    ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS agent_runs_tenant_agent_started_idx
  ON agent_runs (tenant_id, agent_key, started_at);

-- AgentToolCall: every tool invoked during an AgentRun
CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  agent_run_id    UUID        NOT NULL,
  tool_key        TEXT        NOT NULL,
  input_json      JSONB       NOT NULL,
  output_json     JSONB,
  status          TEXT        NOT NULL DEFAULT 'success',
  duration_ms     INT         NOT NULL DEFAULT 0,
  policy_decision TEXT        NOT NULL DEFAULT 'allow',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_tool_calls_pkey  PRIMARY KEY (id),
  CONSTRAINT agent_tool_calls_run_fkey
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_tool_calls_run_id_idx
  ON agent_tool_calls (agent_run_id);
