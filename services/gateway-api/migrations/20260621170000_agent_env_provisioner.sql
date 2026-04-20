CREATE TABLE IF NOT EXISTS agent_env_provisioner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  provider TEXT NOT NULL DEFAULT 'docker',
  template_repo TEXT,
  auto_cleanup BOOLEAN NOT NULL DEFAULT true,
  max_environments INTEGER NOT NULL DEFAULT 5,
  ttl_hours INTEGER NOT NULL DEFAULT 24,
  resource_limits JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_provisioner_agent ON agent_env_provisioner_configs(agent_id);
CREATE INDEX idx_env_provisioner_enabled ON agent_env_provisioner_configs(enabled);
