CREATE TABLE IF NOT EXISTS agent_secrets_rotator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  secret_name VARCHAR(500) NOT NULL,
  rotation_days INTEGER DEFAULT 90,
  last_rotated_at TIMESTAMPTZ,
  vault_backend VARCHAR(100) DEFAULT 'internal',
  notify_on_rotation BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_secrets_rotator_configs_agent ON agent_secrets_rotator_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_secrets_rotator_configs_enabled ON agent_secrets_rotator_configs(enabled);
