CREATE TABLE IF NOT EXISTS agent_resource_scaler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scaling_policy TEXT NOT NULL DEFAULT 'auto',
  min_replicas INTEGER NOT NULL DEFAULT 1,
  max_replicas INTEGER NOT NULL DEFAULT 10,
  cpu_threshold NUMERIC NOT NULL DEFAULT 75.0,
  memory_threshold NUMERIC NOT NULL DEFAULT 80.0,
  cooldown_period TEXT NOT NULL DEFAULT '5m',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resource_scaler_agent ON agent_resource_scaler_configs(agent_id);
CREATE INDEX idx_resource_scaler_enabled ON agent_resource_scaler_configs(enabled);
