-- Batch 41 — Cross-Platform Revenue Dashboard
-- Unified analytics across all revenue streams

CREATE TABLE IF NOT EXISTS revenue_streams (
  id              TEXT PRIMARY KEY,
  stream_type     TEXT NOT NULL CHECK (stream_type IN (
    'marketplace','publishing','misiuni','merch','trading','service_domain',
    'research','integration','collaboration','subscription','donation','advertising'
  )),
  stream_name     TEXT NOT NULL,
  stream_status   TEXT NOT NULL DEFAULT 'active' CHECK (stream_status IN (
    'active','paused','closed','pending','auditing'
  )),
  owner_agent_id  TEXT,
  currency        TEXT NOT NULL DEFAULT '47TOKEN',
  total_revenue   NUMERIC NOT NULL DEFAULT 0,
  total_expenses  NUMERIC NOT NULL DEFAULT 0,
  net_profit      NUMERIC NOT NULL DEFAULT 0,
  tx_count        INTEGER NOT NULL DEFAULT 0,
  first_tx_at     TIMESTAMPTZ,
  last_tx_at      TIMESTAMPTZ,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id              TEXT PRIMARY KEY,
  stream_id       TEXT NOT NULL REFERENCES revenue_streams(id),
  period_type     TEXT NOT NULL CHECK (period_type IN (
    'hourly','daily','weekly','monthly','quarterly','yearly'
  )),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  revenue         NUMERIC NOT NULL DEFAULT 0,
  expenses        NUMERIC NOT NULL DEFAULT 0,
  net             NUMERIC NOT NULL DEFAULT 0,
  tx_count        INTEGER NOT NULL DEFAULT 0,
  top_items       JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_goals (
  id              TEXT PRIMARY KEY,
  goal_name       TEXT NOT NULL,
  goal_type       TEXT NOT NULL CHECK (goal_type IN (
    'revenue_target','profit_target','tx_volume','stream_launch','expense_cap','growth_rate'
  )),
  target_value    NUMERIC NOT NULL,
  current_value   NUMERIC NOT NULL DEFAULT 0,
  goal_status     TEXT NOT NULL DEFAULT 'active' CHECK (goal_status IN (
    'active','achieved','missed','cancelled','paused'
  )),
  deadline        TIMESTAMPTZ,
  stream_id       TEXT REFERENCES revenue_streams(id),
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_alerts (
  id              TEXT PRIMARY KEY,
  alert_type      TEXT NOT NULL CHECK (alert_type IN (
    'revenue_drop','expense_spike','goal_at_risk','stream_inactive',
    'anomaly_detected','milestone_reached','budget_exceeded'
  )),
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
    'info','warning','critical'
  )),
  stream_id       TEXT REFERENCES revenue_streams(id),
  goal_id         TEXT REFERENCES revenue_goals(id),
  message         TEXT NOT NULL,
  acknowledged    BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_streams_type ON revenue_streams(stream_type);
CREATE INDEX IF NOT EXISTS idx_revenue_streams_status ON revenue_streams(stream_status);
CREATE INDEX IF NOT EXISTS idx_revenue_streams_owner ON revenue_streams(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_stream ON revenue_snapshots(stream_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_period ON revenue_snapshots(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_revenue_goals_status ON revenue_goals(goal_status);
CREATE INDEX IF NOT EXISTS idx_revenue_goals_stream ON revenue_goals(stream_id);
CREATE INDEX IF NOT EXISTS idx_revenue_alerts_type ON revenue_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_revenue_alerts_severity ON revenue_alerts(severity, acknowledged);
