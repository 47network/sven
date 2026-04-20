CREATE TABLE IF NOT EXISTS agent_failover_tester_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_service VARCHAR(500) NOT NULL,
  test_type VARCHAR(100) DEFAULT 'chaos',
  recovery_time_target_s INTEGER DEFAULT 300,
  last_test_at TIMESTAMPTZ,
  last_recovery_time_s INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_failover_tester_configs_agent ON agent_failover_tester_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_failover_tester_configs_enabled ON agent_failover_tester_configs(enabled);
