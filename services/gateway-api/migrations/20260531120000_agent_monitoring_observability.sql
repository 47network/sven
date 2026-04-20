-- Batch 58 — Agent Monitoring & Observability
-- Adds metric collection, alerting, dashboards, log aggregation, and SLO tracking

CREATE TABLE IF NOT EXISTS agent_metrics (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  metric_name   TEXT NOT NULL,
  metric_type   TEXT NOT NULL CHECK (metric_type IN ('counter','gauge','histogram','summary','rate')),
  value         DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit          TEXT,
  labels        JSONB DEFAULT '{}',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_alerts (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  alert_name    TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('info','warning','critical','emergency','resolved')),
  condition     TEXT NOT NULL,
  threshold     DOUBLE PRECISION,
  current_value DOUBLE PRECISION,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing','acknowledged','resolved','silenced','expired')),
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dashboards (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  layout        JSONB DEFAULT '[]',
  panels        JSONB DEFAULT '[]',
  refresh_interval_sec INTEGER DEFAULT 30,
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_log_entries (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  level         TEXT NOT NULL CHECK (level IN ('debug','info','warn','error','fatal')),
  message       TEXT NOT NULL,
  context       JSONB DEFAULT '{}',
  source        TEXT,
  trace_id      TEXT,
  span_id       TEXT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_slo_targets (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  slo_name      TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK (target_type IN ('availability','latency','error_rate','throughput','saturation')),
  target_value  DOUBLE PRECISION NOT NULL,
  current_value DOUBLE PRECISION DEFAULT 0,
  window_hours  INTEGER NOT NULL DEFAULT 720,
  budget_remaining DOUBLE PRECISION DEFAULT 100,
  status        TEXT NOT NULL DEFAULT 'met' CHECK (status IN ('met','at_risk','breached','unknown','suspended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_metrics
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_name ON agent_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_recorded ON agent_metrics(recorded_at);

-- Indexes for agent_alerts
CREATE INDEX IF NOT EXISTS idx_agent_alerts_agent ON agent_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_severity ON agent_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_status ON agent_alerts(status);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_fired ON agent_alerts(fired_at);

-- Indexes for agent_dashboards
CREATE INDEX IF NOT EXISTS idx_agent_dashboards_owner ON agent_dashboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_dashboards_public ON agent_dashboards(is_public);

-- Indexes for agent_log_entries
CREATE INDEX IF NOT EXISTS idx_agent_log_entries_agent ON agent_log_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_log_entries_level ON agent_log_entries(level);
CREATE INDEX IF NOT EXISTS idx_agent_log_entries_trace ON agent_log_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_log_entries_recorded ON agent_log_entries(recorded_at);

-- Indexes for agent_slo_targets
CREATE INDEX IF NOT EXISTS idx_agent_slo_targets_agent ON agent_slo_targets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_slo_targets_type ON agent_slo_targets(target_type);
CREATE INDEX IF NOT EXISTS idx_agent_slo_targets_status ON agent_slo_targets(status);
