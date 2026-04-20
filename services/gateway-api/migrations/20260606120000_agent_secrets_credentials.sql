-- Batch 64: Agent Secrets & Credentials Management
-- Secure vault for API keys, tokens, credentials with rotation and audit

CREATE TABLE IF NOT EXISTS agent_secrets (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  secret_name     TEXT NOT NULL,
  secret_type     TEXT NOT NULL CHECK (secret_type IN ('api_key', 'token', 'password', 'certificate', 'ssh_key', 'webhook_secret')),
  encrypted_value TEXT NOT NULL,
  encryption_algo TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_version     INTEGER NOT NULL DEFAULT 1,
  scope           TEXT NOT NULL CHECK (scope IN ('agent', 'crew', 'global', 'service', 'environment')) DEFAULT 'agent',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, secret_name)
);

CREATE TABLE IF NOT EXISTS secret_rotations (
  id              TEXT PRIMARY KEY,
  secret_id       TEXT NOT NULL REFERENCES agent_secrets(id) ON DELETE CASCADE,
  rotation_type   TEXT NOT NULL CHECK (rotation_type IN ('manual', 'scheduled', 'forced', 'expired', 'compromised')),
  old_key_version INTEGER NOT NULL,
  new_key_version INTEGER NOT NULL,
  rotated_by      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')) DEFAULT 'pending',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_access_logs (
  id              TEXT PRIMARY KEY,
  secret_id       TEXT NOT NULL REFERENCES agent_secrets(id) ON DELETE CASCADE,
  accessed_by     TEXT NOT NULL,
  access_type     TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'rotate', 'revoke', 'list', 'export')),
  ip_address      TEXT,
  user_agent      TEXT,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_policies (
  id              TEXT PRIMARY KEY,
  policy_name     TEXT NOT NULL UNIQUE,
  secret_type     TEXT NOT NULL,
  max_age_days    INTEGER NOT NULL DEFAULT 90,
  rotation_days   INTEGER NOT NULL DEFAULT 30,
  min_length      INTEGER NOT NULL DEFAULT 32,
  require_rotation BOOLEAN NOT NULL DEFAULT TRUE,
  notify_before_days INTEGER NOT NULL DEFAULT 7,
  auto_rotate     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_shares (
  id              TEXT PRIMARY KEY,
  secret_id       TEXT NOT NULL REFERENCES agent_secrets(id) ON DELETE CASCADE,
  shared_with     TEXT NOT NULL,
  share_type      TEXT NOT NULL CHECK (share_type IN ('read', 'use', 'rotate', 'admin')),
  granted_by      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secrets_agent ON agent_secrets(agent_id);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON agent_secrets(secret_type);
CREATE INDEX IF NOT EXISTS idx_secrets_scope ON agent_secrets(scope);
CREATE INDEX IF NOT EXISTS idx_secrets_active ON agent_secrets(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_secrets_expires ON agent_secrets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_secret_rotations_secret ON secret_rotations(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_rotations_status ON secret_rotations(status);
CREATE INDEX IF NOT EXISTS idx_secret_rotations_created ON secret_rotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_access_secret ON secret_access_logs(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_by ON secret_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_secret_access_type ON secret_access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_secret_access_created ON secret_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_policies_type ON secret_policies(secret_type);
CREATE INDEX IF NOT EXISTS idx_secret_shares_secret ON secret_shares(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_shares_with ON secret_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_secret_shares_active ON secret_shares(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_secret_shares_expires ON secret_shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_name ON agent_secrets(secret_name);
CREATE INDEX IF NOT EXISTS idx_secret_rotations_type ON secret_rotations(rotation_type);
