-- Batch 424: Key Escrow
CREATE TABLE IF NOT EXISTS agent_key_escrow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  encryption_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_rotation_days INTEGER NOT NULL DEFAULT 90,
  backup_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_escrowed_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_key_escrow_configs(id),
  key_alias TEXT NOT NULL,
  key_type TEXT NOT NULL CHECK (key_type IN ('symmetric','asymmetric','signing','encryption','api')),
  encrypted_key_data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotated','revoked','archived')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_key_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES agent_escrowed_keys(id),
  accessor_agent_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read','create','rotate','revoke','backup','restore')),
  ip_address TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_key_escrow_configs_agent ON agent_key_escrow_configs(agent_id);
CREATE INDEX idx_agent_escrowed_keys_config ON agent_escrowed_keys(config_id);
CREATE INDEX idx_agent_key_access_logs_key ON agent_key_access_logs(key_id);
