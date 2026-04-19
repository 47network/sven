-- Batch 398: Token Issuer — JWT/API-key issuance and lifecycle
CREATE TABLE IF NOT EXISTS agent_token_issuer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'RS256',
  issuer TEXT NOT NULL,
  default_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  max_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  refresh_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_issued_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_token_issuer_configs(id),
  token_type TEXT NOT NULL DEFAULT 'access',
  subject TEXT NOT NULL,
  audience TEXT,
  scopes TEXT[] DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS agent_token_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES agent_issued_tokens(id),
  reason TEXT NOT NULL,
  revoked_by TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_issuer_agent ON agent_token_issuer_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_issued_tokens_config ON agent_issued_tokens(config_id);
CREATE INDEX IF NOT EXISTS idx_issued_tokens_subject ON agent_issued_tokens(subject);
CREATE INDEX IF NOT EXISTS idx_token_revocations_token ON agent_token_revocations(token_id);
