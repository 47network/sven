-- Batch 330: RBAC Enforcer - Role-based access control enforcement
CREATE TABLE IF NOT EXISTS agent_rbac_enforcer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  enforcement_mode VARCHAR(20) NOT NULL DEFAULT 'enforce',
  default_policy VARCHAR(20) NOT NULL DEFAULT 'deny',
  audit_enabled BOOLEAN NOT NULL DEFAULT true,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rbac_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rbac_enforcer_configs(id),
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  parent_role_id UUID,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rbac_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rbac_enforcer_configs(id),
  role_id UUID NOT NULL REFERENCES agent_rbac_roles(id),
  subject_id VARCHAR(255) NOT NULL,
  subject_type VARCHAR(50) NOT NULL DEFAULT 'agent',
  scope VARCHAR(255),
  expires_at TIMESTAMPTZ,
  granted_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rbac_enforcer_configs_agent ON agent_rbac_enforcer_configs(agent_id);
CREATE INDEX idx_rbac_roles_config ON agent_rbac_roles(config_id);
CREATE INDEX idx_rbac_assignments_config ON agent_rbac_assignments(config_id);
