-- Batch 106 — Agent Canary Deployment
-- Traffic splitting, rollback triggers, metrics comparison

CREATE TABLE IF NOT EXISTS agent_canary_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  service_name    TEXT NOT NULL,
  baseline_version TEXT NOT NULL,
  canary_version  TEXT NOT NULL,
  traffic_pct     DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rolling','paused','promoted','rolled_back','failed')),
  promotion_criteria JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  promoted_at     TIMESTAMPTZ,
  rolled_back_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_canary_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id      UUID NOT NULL REFERENCES agent_canary_releases(id) ON DELETE CASCADE,
  variant         TEXT NOT NULL CHECK (variant IN ('baseline','canary')),
  metric_name     TEXT NOT NULL,
  metric_value    DOUBLE PRECISION NOT NULL,
  sample_count    BIGINT NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_canary_rollback_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id      UUID NOT NULL REFERENCES agent_canary_releases(id) ON DELETE CASCADE,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('error_rate','latency_p99','cpu_spike','memory_spike','custom')),
  threshold       DOUBLE PRECISION NOT NULL,
  current_value   DOUBLE PRECISION,
  fired           BOOLEAN NOT NULL DEFAULT false,
  fired_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_canary_releases_agent ON agent_canary_releases(agent_id);
CREATE INDEX idx_canary_releases_status ON agent_canary_releases(status);
CREATE INDEX idx_canary_metrics_release ON agent_canary_metrics(release_id);
CREATE INDEX idx_canary_metrics_variant ON agent_canary_metrics(variant, metric_name);
CREATE INDEX idx_canary_triggers_release ON agent_canary_rollback_triggers(release_id);
