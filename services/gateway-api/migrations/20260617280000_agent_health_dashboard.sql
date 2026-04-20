-- Batch 91: Agent Health Dashboard
-- Health checks, dashboards, widgets, thresholds, and alert rules

CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('agent','service','database','queue','api','infrastructure')),
  target_id TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('ping','http','tcp','custom','heartbeat','metric_threshold')),
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy','degraded','unhealthy','unknown','maintenance')),
  last_check_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_agent_id TEXT,
  layout JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_widgets (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL REFERENCES health_dashboards(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('gauge','chart','table','status_grid','timeline','heatmap','counter','sparkline')),
  title TEXT NOT NULL,
  data_source TEXT NOT NULL,
  query JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":3}',
  config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_thresholds (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  warning_value NUMERIC,
  critical_value NUMERIC,
  comparison TEXT NOT NULL DEFAULT 'gt' CHECK (comparison IN ('gt','gte','lt','lte','eq','neq')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  check_id TEXT REFERENCES health_checks(id) ON DELETE CASCADE,
  condition JSONB NOT NULL DEFAULT '{}',
  notification_channels JSONB NOT NULL DEFAULT '[]',
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical','fatal')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hc_target ON health_checks(target_type, target_id);
CREATE INDEX idx_hc_status ON health_checks(status);
CREATE INDEX idx_hc_type ON health_checks(check_type);
CREATE INDEX idx_hc_next ON health_checks(next_check_at);
CREATE INDEX idx_hd_name ON health_dashboards(name);
CREATE INDEX idx_hd_owner ON health_dashboards(owner_agent_id);
CREATE INDEX idx_hd_public ON health_dashboards(is_public) WHERE is_public = true;
CREATE INDEX idx_hd_created ON health_dashboards(created_at DESC);
CREATE INDEX idx_hw_dashboard ON health_widgets(dashboard_id);
CREATE INDEX idx_hw_type ON health_widgets(widget_type);
CREATE INDEX idx_hw_source ON health_widgets(data_source);
CREATE INDEX idx_hw_created ON health_widgets(created_at DESC);
CREATE INDEX idx_ht_check ON health_thresholds(check_id);
CREATE INDEX idx_ht_metric ON health_thresholds(metric_name);
CREATE INDEX idx_ht_enabled ON health_thresholds(enabled) WHERE enabled = true;
CREATE INDEX idx_har_check ON health_alert_rules(check_id);
CREATE INDEX idx_har_severity ON health_alert_rules(severity);
CREATE INDEX idx_har_active ON health_alert_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_har_triggered ON health_alert_rules(last_triggered_at DESC);
CREATE INDEX idx_har_created ON health_alert_rules(created_at DESC);
