-- Batch 301: RBAC Controller
CREATE TABLE IF NOT EXISTS agent_rbac_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  default_role TEXT NOT NULL DEFAULT 'viewer', enforce_mfa BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 60, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rbac_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_rbac_configs(id),
  role_name TEXT NOT NULL, permissions JSONB NOT NULL DEFAULT '[]',
  inherits_from TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rbac_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role_id UUID NOT NULL REFERENCES agent_rbac_roles(id),
  principal_type TEXT NOT NULL DEFAULT 'agent', principal_id TEXT NOT NULL,
  granted_by TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rbac_configs_agent ON agent_rbac_configs(agent_id);
CREATE INDEX idx_rbac_roles_config ON agent_rbac_roles(config_id);
CREATE INDEX idx_rbac_assignments_role ON agent_rbac_assignments(role_id);
