-- Batch 292: Uptime Monitor
CREATE TABLE IF NOT EXISTS agent_uptime_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  check_interval_seconds INTEGER DEFAULT 60,
  timeout_ms INTEGER DEFAULT 5000,
  expected_status INTEGER DEFAULT 200,
  alert_after_failures INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_uptime_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_uptime_configs(id),
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  headers JSONB DEFAULT '{}',
  current_state TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  last_up_at TIMESTAMPTZ,
  last_down_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_uptime_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_uptime_endpoints(id),
  status_code INTEGER,
  response_ms INTEGER,
  healthy BOOLEAN DEFAULT false,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_uptime_configs_agent ON agent_uptime_configs(agent_id);
CREATE INDEX idx_uptime_endpoints_config ON agent_uptime_endpoints(config_id);
CREATE INDEX idx_uptime_checks_endpoint ON agent_uptime_checks(endpoint_id);
