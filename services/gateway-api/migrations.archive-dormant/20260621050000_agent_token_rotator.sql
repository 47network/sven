CREATE TABLE IF NOT EXISTS agent_token_rotator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  rotation_interval_hours INTEGER NOT NULL DEFAULT 24,
  token_type TEXT NOT NULL DEFAULT 'api_key',
  auto_revoke_old BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB NOT NULL DEFAULT '[]',
  grace_period_minutes INTEGER NOT NULL DEFAULT 30,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_token_rotator_configs_agent ON agent_token_rotator_configs(agent_id);
CREATE INDEX idx_agent_token_rotator_configs_enabled ON agent_token_rotator_configs(enabled);
