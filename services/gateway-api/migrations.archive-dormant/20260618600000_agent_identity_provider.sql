-- Batch 223: Identity Provider
CREATE TABLE IF NOT EXISTS agent_identity_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('oauth2','saml','oidc','ldap','custom')),
  configuration JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','configuring')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_identity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES agent_identity_providers(id),
  subject_id TEXT NOT NULL,
  token_hash TEXT,
  claims JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_identity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES agent_identity_providers(id),
  external_id TEXT NOT NULL,
  internal_agent_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_identity_providers_agent ON agent_identity_providers(agent_id);
CREATE INDEX idx_identity_sessions_provider ON agent_identity_sessions(provider_id);
CREATE INDEX idx_identity_mappings_external ON agent_identity_mappings(external_id);
