CREATE TABLE IF NOT EXISTS agent_cost_optimizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  current_cost_monthly NUMERIC(12,2) DEFAULT 0,
  target_savings_percent NUMERIC(5,2) DEFAULT 20,
  optimization_strategy VARCHAR(100) DEFAULT 'rightsizing',
  last_scan_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_cost_optimizer_configs_agent ON agent_cost_optimizer_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_optimizer_configs_enabled ON agent_cost_optimizer_configs(enabled);
