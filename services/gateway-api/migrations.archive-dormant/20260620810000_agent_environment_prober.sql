CREATE TABLE IF NOT EXISTS agent_environment_prober_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  probe_type VARCHAR(100) NOT NULL,
  target_url TEXT NOT NULL,
  expected_status INTEGER DEFAULT 200,
  timeout_ms INTEGER DEFAULT 5000,
  probe_interval_seconds INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_environment_prober_configs_agent ON agent_environment_prober_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_environment_prober_configs_enabled ON agent_environment_prober_configs(enabled);
