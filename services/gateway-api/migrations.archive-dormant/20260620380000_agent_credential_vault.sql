-- Batch 401: Credential Vault — secure credential storage with rotation
CREATE TABLE IF NOT EXISTS agent_credential_vault_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  encryption_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  auto_rotate_days INTEGER NOT NULL DEFAULT 90,
  max_versions INTEGER NOT NULL DEFAULT 5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_credential_vault_configs(id),
  name TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'password',
  encrypted_value BYTEA NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_credential_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES agent_credentials(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  ip_address TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cred_vault_agent ON agent_credential_vault_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_credentials_config ON agent_credentials(config_id);
CREATE INDEX IF NOT EXISTS idx_cred_audit_credential ON agent_credential_audit(credential_id);
