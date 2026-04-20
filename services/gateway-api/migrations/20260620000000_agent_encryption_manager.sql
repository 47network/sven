CREATE TABLE IF NOT EXISTS agent_encryption_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_rotation_days INTEGER NOT NULL DEFAULT 90,
  envelope_encryption BOOLEAN NOT NULL DEFAULT true,
  hsm_enabled BOOLEAN NOT NULL DEFAULT false,
  backup_keys BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_encryption_manager_configs(id),
  agent_id UUID NOT NULL,
  key_alias TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  purpose TEXT NOT NULL DEFAULT 'encryption',
  expires_at TIMESTAMPTZ,
  rotated_from UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_encrypted_data_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES agent_encryption_keys(id),
  data_reference TEXT NOT NULL,
  data_type TEXT NOT NULL,
  encryption_context JSONB NOT NULL DEFAULT '{}',
  encrypted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_agent ON agent_encryption_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_status ON agent_encryption_keys(status);
CREATE INDEX IF NOT EXISTS idx_encrypted_data_key ON agent_encrypted_data_registry(key_id);
