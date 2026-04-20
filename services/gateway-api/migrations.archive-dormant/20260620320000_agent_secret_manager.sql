-- Batch 395: Secret Manager
CREATE TABLE IF NOT EXISTS agent_secret_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  encryption_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_rotation_days INTEGER NOT NULL DEFAULT 90,
  auto_rotate BOOLEAN NOT NULL DEFAULT true,
  audit_access BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_secret_manager_configs(id),
  name TEXT NOT NULL,
  secret_type TEXT NOT NULL DEFAULT 'generic' CHECK (secret_type IN ('generic', 'api_key', 'password', 'certificate', 'ssh_key', 'token')),
  encrypted_value TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, name, version)
);
CREATE TABLE IF NOT EXISTS agent_secret_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES agent_secrets(id),
  accessor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'write', 'rotate', 'delete', 'list')),
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_secrets_config ON agent_secrets(config_id);
CREATE INDEX idx_secrets_name ON agent_secrets(config_id, name);
CREATE INDEX idx_secret_access_logs ON agent_secret_access_logs(secret_id);
