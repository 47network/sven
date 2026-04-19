CREATE TABLE IF NOT EXISTS agent_secret_injector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  vault_provider TEXT NOT NULL DEFAULT 'internal',
  injection_method TEXT NOT NULL DEFAULT 'env_var',
  rotation_enabled BOOLEAN NOT NULL DEFAULT false,
  allowed_namespaces TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  encryption_key_id TEXT,
  audit_logging BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_secret_injector_agent ON agent_secret_injector_configs(agent_id);
CREATE INDEX idx_secret_injector_enabled ON agent_secret_injector_configs(enabled);
