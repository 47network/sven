-- Batch 400: Role Manager — hierarchical role management
CREATE TABLE IF NOT EXISTS agent_role_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  hierarchy_enabled BOOLEAN NOT NULL DEFAULT true,
  max_roles_per_subject INTEGER NOT NULL DEFAULT 10,
  inheritance_depth INTEGER NOT NULL DEFAULT 5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_role_manager_configs(id),
  name TEXT NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES agent_roles(id),
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_role_manager_configs(id),
  role_id UUID NOT NULL REFERENCES agent_roles(id),
  subject TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_mgr_agent ON agent_role_manager_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_roles_config ON agent_roles(config_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_subject ON agent_role_assignments(subject);
