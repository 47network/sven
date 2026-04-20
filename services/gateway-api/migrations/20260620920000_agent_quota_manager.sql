CREATE TABLE IF NOT EXISTS agent_quota_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  quota_name VARCHAR(500) NOT NULL,
  resource_type VARCHAR(100) DEFAULT 'compute',
  current_usage NUMERIC DEFAULT 0,
  quota_limit NUMERIC NOT NULL,
  alert_threshold_percent NUMERIC(5,2) DEFAULT 80,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_quota_manager_configs_agent ON agent_quota_manager_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_quota_manager_configs_enabled ON agent_quota_manager_configs(enabled);
