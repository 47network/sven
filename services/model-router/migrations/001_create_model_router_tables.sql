-- Migration 001: Create model router tables
-- Tables: model_registry, fleet_nodes, fleet_probes, routing_decisions, benchmark_runs

BEGIN;

-- ── Model Registry ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_registry (
  id                    TEXT        PRIMARY KEY,
  name                  TEXT        NOT NULL,
  provider              TEXT        NOT NULL DEFAULT 'local',
  version               TEXT        NOT NULL DEFAULT '1.0',
  parameter_count       TEXT        NOT NULL,             -- '7B', '32B', etc.
  quantization          TEXT        NOT NULL DEFAULT 'gguf',
  supported_tasks       TEXT[]      NOT NULL DEFAULT '{}',
  vram_requirement_mb   INTEGER     NOT NULL DEFAULT 0,
  disk_size_mb          INTEGER     NOT NULL DEFAULT 0,
  context_window        INTEGER     NOT NULL DEFAULT 4096,
  max_output_tokens     INTEGER     NOT NULL DEFAULT 2048,
  license               TEXT        NOT NULL DEFAULT 'unknown',
  license_commercial    BOOLEAN     NOT NULL DEFAULT false,
  endpoint              TEXT,                              -- inference URL
  host_device           TEXT,                              -- VM/device identifier
  status                TEXT        NOT NULL DEFAULT 'available',
  tokens_per_second     REAL,
  last_health_check     TIMESTAMPTZ,
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id                TEXT        NOT NULL,
  metadata              JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_model_registry_org        ON model_registry (org_id);
CREATE INDEX IF NOT EXISTS idx_model_registry_status     ON model_registry (status);
CREATE INDEX IF NOT EXISTS idx_model_registry_tasks      ON model_registry USING GIN (supported_tasks);
CREATE INDEX IF NOT EXISTS idx_model_registry_provider   ON model_registry (provider);

-- ── Fleet Nodes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet_nodes (
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  endpoint          TEXT        NOT NULL,
  runtime           TEXT        NOT NULL CHECK (runtime IN ('ollama', 'llama-server')),
  gpus              JSONB       NOT NULL DEFAULT '[]',
  total_vram_mb     INTEGER     NOT NULL DEFAULT 0,
  healthy           BOOLEAN     NOT NULL DEFAULT false,
  last_probe        TIMESTAMPTZ,
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id            TEXT        NOT NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fleet_nodes_org     ON fleet_nodes (org_id);
CREATE INDEX IF NOT EXISTS idx_fleet_nodes_healthy ON fleet_nodes (healthy);

-- ── Fleet Probes (time-series health snapshots) ────────────────────────────
CREATE TABLE IF NOT EXISTS fleet_probes (
  id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  node_id           TEXT        NOT NULL REFERENCES fleet_nodes(id) ON DELETE CASCADE,
  healthy           BOOLEAN     NOT NULL,
  vram_used_mb      INTEGER     NOT NULL DEFAULT 0,
  vram_free_mb      INTEGER     NOT NULL DEFAULT 0,
  loaded_models     JSONB       NOT NULL DEFAULT '[]',
  probed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_probes_node    ON fleet_probes (node_id, probed_at DESC);

-- Partition-friendly: auto-expire old probes (30 days)
-- Application-level cleanup via: DELETE FROM fleet_probes WHERE probed_at < now() - interval '30 days'

-- ── Routing Decisions (audit trail) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routing_decisions (
  id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id        TEXT        NOT NULL,
  org_id            TEXT        NOT NULL,
  task              TEXT        NOT NULL,
  priority          TEXT        NOT NULL DEFAULT 'balanced',
  model_id          TEXT        NOT NULL,
  model_name        TEXT        NOT NULL,
  score             REAL        NOT NULL,
  reason            TEXT        NOT NULL,
  fallback_chain    TEXT[]      NOT NULL DEFAULT '{}',
  latency_ms        REAL,
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_org   ON routing_decisions (org_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_model ON routing_decisions (model_id, decided_at DESC);

-- ── Benchmark Runs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id                TEXT        PRIMARY KEY,
  suite_id          TEXT        NOT NULL,
  model_id          TEXT        NOT NULL,
  org_id            TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  task_results      JSONB       NOT NULL DEFAULT '[]',
  aggregate_metrics JSONB,
  metadata          JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_org    ON benchmark_runs (org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_model  ON benchmark_runs (model_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs (status);

COMMIT;
