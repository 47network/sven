-- Batch 299: Credential Rotator
CREATE TABLE IF NOT EXISTS agent_cred_rot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  rotation_interval_days INTEGER DEFAULT 90, auto_rotate BOOLEAN DEFAULT true,
  vault_type TEXT NOT NULL DEFAULT 'internal', notification_channels JSONB DEFAULT '["nats"]',
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_cred_rot_configs(id),
  credential_name TEXT NOT NULL, credential_type TEXT NOT NULL DEFAULT 'api_key',
  last_rotated_at TIMESTAMPTZ, next_rotation_at TIMESTAMPTZ, rotation_count INTEGER DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rotation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), credential_id UUID NOT NULL REFERENCES agent_credentials(id),
  rotated_by TEXT NOT NULL DEFAULT 'system', success BOOLEAN DEFAULT true,
  error TEXT, old_expiry TIMESTAMPTZ, new_expiry TIMESTAMPTZ, rotated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cred_rot_configs_agent ON agent_cred_rot_configs(agent_id);
CREATE INDEX idx_credentials_config ON agent_credentials(config_id);
CREATE INDEX idx_rotation_logs_credential ON agent_rotation_logs(credential_id);
