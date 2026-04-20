-- Batch 188: Credential Manager — secure credential lifecycle management
BEGIN;

CREATE TABLE IF NOT EXISTS agent_credential_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  store_type VARCHAR(50) NOT NULL CHECK (store_type IN ('vault','keychain','env_vars','config_file','kms','hsm')),
  provider VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','rotating','archived','compromised')),
  encryption_algorithm VARCHAR(50) DEFAULT 'aes-256-gcm',
  credential_count INT DEFAULT 0,
  last_audit_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES agent_credential_stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  credential_type VARCHAR(50) NOT NULL CHECK (credential_type IN ('api_key','password','token','certificate','ssh_key','oauth','service_account')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','rotating','pending')),
  expires_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  rotation_interval_days INT,
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_credential_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES agent_credentials(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created','accessed','rotated','revoked','expired','leaked','recovered')),
  actor_agent_id UUID,
  ip_address VARCHAR(45),
  details JSONB DEFAULT '{}',
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('critical','high','medium','low','info')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_credential_stores_agent ON agent_credential_stores(agent_id);
CREATE INDEX idx_agent_credentials_store ON agent_credentials(store_id);
CREATE INDEX idx_agent_credential_audits_credential ON agent_credential_audits(credential_id);
CREATE INDEX idx_agent_credentials_status ON agent_credentials(status);
CREATE INDEX idx_agent_credential_audits_action ON agent_credential_audits(action);

COMMIT;
