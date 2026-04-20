-- Batch 234: Permission Manager
-- Manages granular permissions and role-based access control

CREATE TABLE IF NOT EXISTS agent_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  role_name VARCHAR(128) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  parent_role_id UUID REFERENCES agent_roles(id),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_agent_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES agent_roles(id),
  granted_by UUID NOT NULL,
  scope JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_permission_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  permission VARCHAR(255) NOT NULL,
  resource VARCHAR(255),
  result VARCHAR(32) NOT NULL CHECK (result IN ('granted', 'denied', 'delegated')),
  evaluated_roles JSONB DEFAULT '[]',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_agent ON agent_roles(agent_id);
CREATE INDEX idx_role_assignments_target ON agent_role_assignments(target_agent_id);
CREATE INDEX idx_role_assignments_role ON agent_role_assignments(role_id);
CREATE INDEX idx_permission_checks_agent ON agent_permission_checks(agent_id);
