CREATE TABLE IF NOT EXISTS agent_secret_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'kv' CHECK (engine IN ('kv','transit','pki','database','ssh')),
  max_versions INTEGER NOT NULL DEFAULT 10,
  cas_required BOOLEAN NOT NULL DEFAULT false,
  sealed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES agent_secret_vaults(id),
  path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  encrypted_data BYTEA NOT NULL,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_secret_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES agent_secret_vaults(id),
  secret_id UUID REFERENCES agent_secrets(id),
  action TEXT NOT NULL CHECK (action IN ('read','write','delete','rotate','seal','unseal','list')),
  accessor TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaults_agent ON agent_secret_vaults(agent_id);
CREATE INDEX idx_secrets_vault ON agent_secrets(vault_id);
CREATE INDEX idx_secrets_path ON agent_secrets(path);
CREATE INDEX idx_secrets_expiry ON agent_secrets(expires_at);
CREATE INDEX idx_access_vault ON agent_secret_access_log(vault_id);
CREATE INDEX idx_access_action ON agent_secret_access_log(action);
