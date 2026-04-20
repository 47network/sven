CREATE TABLE IF NOT EXISTS agent_permission_mapper_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  permission_model TEXT NOT NULL DEFAULT 'rbac',
  role_hierarchy JSONB NOT NULL DEFAULT '{}',
  default_permissions JSONB NOT NULL DEFAULT '[]',
  inheritance_enabled BOOLEAN NOT NULL DEFAULT true,
  audit_changes BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_permission_mapper_configs_agent ON agent_permission_mapper_configs(agent_id);
CREATE INDEX idx_agent_permission_mapper_configs_enabled ON agent_permission_mapper_configs(enabled);
