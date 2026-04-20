CREATE TABLE IF NOT EXISTS agent_change_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  change_type VARCHAR(100) NOT NULL,
  risk_level VARCHAR(50) DEFAULT 'low',
  approval_required BOOLEAN DEFAULT true,
  rollback_plan TEXT,
  scheduled_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_change_manager_configs_agent ON agent_change_manager_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_change_manager_configs_enabled ON agent_change_manager_configs(enabled);
