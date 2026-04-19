-- Batch 426: Uptime Sentinel
CREATE TABLE IF NOT EXISTS agent_uptime_sentinel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  check_interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  alert_after_failures INTEGER NOT NULL DEFAULT 3,
  regions TEXT[] DEFAULT '{"eu-central"}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_uptime_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_uptime_sentinel_configs(id),
  endpoint_url TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'https' CHECK (protocol IN ('http','https','tcp','icmp','dns')),
  expected_status INTEGER DEFAULT 200,
  current_status TEXT NOT NULL DEFAULT 'unknown' CHECK (current_status IN ('up','down','degraded','unknown')),
  uptime_pct NUMERIC(5,2) DEFAULT 100.00,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_uptime_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES agent_uptime_monitors(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  root_cause TEXT,
  impact TEXT NOT NULL DEFAULT 'partial' CHECK (impact IN ('none','partial','major','total')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_uptime_sentinel_configs_agent ON agent_uptime_sentinel_configs(agent_id);
CREATE INDEX idx_agent_uptime_monitors_config ON agent_uptime_monitors(config_id);
CREATE INDEX idx_agent_uptime_incidents_monitor ON agent_uptime_incidents(monitor_id);
