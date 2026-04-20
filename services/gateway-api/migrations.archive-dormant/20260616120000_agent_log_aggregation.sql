-- Batch 74: Agent Log Aggregation & Search
-- Centralized log collection, searching, dashboarding and alerting for agents

CREATE TABLE IF NOT EXISTS log_streams (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL,
  stream_name    TEXT NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('agent','service','task','event','system','external')),
  retention_days INTEGER NOT NULL DEFAULT 30,
  format         TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json','text','structured','binary')),
  tags           JSONB NOT NULL DEFAULT '[]',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_entries (
  id          TEXT PRIMARY KEY,
  stream_id   TEXT NOT NULL REFERENCES log_streams(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('trace','debug','info','warn','error','fatal')),
  message     TEXT NOT NULL,
  context     JSONB NOT NULL DEFAULT '{}',
  source_file TEXT,
  source_line INTEGER,
  trace_id    TEXT,
  span_id     TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  indexed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_filters (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  filter_name TEXT NOT NULL,
  query       TEXT NOT NULL,
  streams     TEXT[] NOT NULL DEFAULT '{}',
  levels      TEXT[] NOT NULL DEFAULT '{}',
  date_range  JSONB NOT NULL DEFAULT '{}',
  is_saved    BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_dashboards (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL,
  dashboard_name  TEXT NOT NULL,
  widgets         JSONB NOT NULL DEFAULT '[]',
  layout          JSONB NOT NULL DEFAULT '{}',
  refresh_interval INTEGER NOT NULL DEFAULT 30,
  is_shared       BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_alerts (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  alert_name    TEXT NOT NULL,
  condition     JSONB NOT NULL DEFAULT '{}',
  severity      TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  channels      JSONB NOT NULL DEFAULT '[]',
  cooldown_min  INTEGER NOT NULL DEFAULT 15,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count    INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_streams_agent ON log_streams(agent_id);
CREATE INDEX IF NOT EXISTS idx_log_streams_source ON log_streams(source);
CREATE INDEX IF NOT EXISTS idx_log_streams_active ON log_streams(is_active);
CREATE INDEX IF NOT EXISTS idx_log_streams_created ON log_streams(created_at);

CREATE INDEX IF NOT EXISTS idx_log_entries_stream ON log_entries(stream_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_entries_trace ON log_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_span ON log_entries(span_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_indexed ON log_entries(indexed_at);

CREATE INDEX IF NOT EXISTS idx_log_filters_owner ON log_filters(owner_id);
CREATE INDEX IF NOT EXISTS idx_log_filters_saved ON log_filters(is_saved);
CREATE INDEX IF NOT EXISTS idx_log_filters_created ON log_filters(created_at);

CREATE INDEX IF NOT EXISTS idx_log_dashboards_owner ON log_dashboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_log_dashboards_shared ON log_dashboards(is_shared);
CREATE INDEX IF NOT EXISTS idx_log_dashboards_created ON log_dashboards(created_at);

CREATE INDEX IF NOT EXISTS idx_log_alerts_owner ON log_alerts(owner_id);
CREATE INDEX IF NOT EXISTS idx_log_alerts_severity ON log_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_log_alerts_enabled ON log_alerts(is_enabled);
CREATE INDEX IF NOT EXISTS idx_log_alerts_fired ON log_alerts(last_fired_at);
