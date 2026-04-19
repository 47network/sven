CREATE TABLE IF NOT EXISTS agent_health_dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  dashboard_name VARCHAR(500) NOT NULL,
  refresh_seconds INTEGER DEFAULT 30,
  widgets JSONB DEFAULT '[]',
  alert_rules JSONB DEFAULT '[]',
  retention_days INTEGER DEFAULT 90,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_health_dashboard_configs_agent ON agent_health_dashboard_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_dashboard_configs_enabled ON agent_health_dashboard_configs(enabled);
