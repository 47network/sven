-- Batch 402: OAuth Manager — OAuth2/OIDC provider management
CREATE TABLE IF NOT EXISTS agent_oauth_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  supported_flows TEXT[] DEFAULT '{authorization_code,client_credentials}',
  token_endpoint TEXT,
  auth_endpoint TEXT,
  pkce_required BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_oauth_manager_configs(id),
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  redirect_uris TEXT[] DEFAULT '{}',
  scopes TEXT[] DEFAULT '{}',
  grant_types TEXT[] DEFAULT '{authorization_code}',
  is_confidential BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_oauth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agent_oauth_clients(id),
  subject TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  code TEXT,
  code_expires_at TIMESTAMPTZ,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_mgr_agent ON agent_oauth_manager_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_config ON agent_oauth_clients(config_id);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_client ON agent_oauth_grants(client_id);
