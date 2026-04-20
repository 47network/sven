-- Batch 235: Token Validator
-- Validates, issues, and manages authentication tokens

CREATE TABLE IF NOT EXISTS agent_token_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  token_type VARCHAR(64) NOT NULL CHECK (token_type IN ('jwt', 'api_key', 'oauth2', 'session', 'refresh', 'service')),
  issuer VARCHAR(255) NOT NULL,
  audience VARCHAR(255),
  algorithm VARCHAR(32) NOT NULL DEFAULT 'RS256',
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  rotation_policy JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_issued_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_token_configs(id),
  agent_id UUID NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  claims JSONB DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'refreshed'))
);

CREATE TABLE IF NOT EXISTS agent_token_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES agent_issued_tokens(id),
  agent_id UUID NOT NULL,
  validation_result VARCHAR(32) NOT NULL CHECK (validation_result IN ('valid', 'expired', 'revoked', 'invalid_signature', 'malformed')),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_configs_agent ON agent_token_configs(agent_id);
CREATE INDEX idx_issued_tokens_config ON agent_issued_tokens(config_id);
CREATE INDEX idx_issued_tokens_agent ON agent_issued_tokens(agent_id);
CREATE INDEX idx_issued_tokens_hash ON agent_issued_tokens(token_hash);
CREATE INDEX idx_token_validations_token ON agent_token_validations(token_id);
