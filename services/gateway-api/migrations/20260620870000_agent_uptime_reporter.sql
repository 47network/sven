CREATE TABLE IF NOT EXISTS agent_uptime_reporter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_name VARCHAR(500) NOT NULL,
  sla_target_percent NUMERIC(5,2) DEFAULT 99.9,
  reporting_interval VARCHAR(50) DEFAULT 'daily',
  downtime_minutes INTEGER DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_uptime_reporter_configs_agent ON agent_uptime_reporter_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_uptime_reporter_configs_enabled ON agent_uptime_reporter_configs(enabled);
