-- Batch 192: Access Controller — RBAC and access policy management
BEGIN;

CREATE TABLE IF NOT EXISTS agent_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('rbac','abac','acl','mandatory','discretionary','rule_based')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','draft','archived','under_review')),
  description TEXT,
  priority INT DEFAULT 100,
  effect VARCHAR(20) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny','conditional')),
  conditions JSONB DEFAULT '{}',
  resources TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_access_policies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('admin','operator','viewer','auditor','service','custom')),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  scope VARCHAR(50) DEFAULT 'global' CHECK (scope IN ('global','project','team','resource','namespace')),
  inherits_from UUID,
  max_sessions INT,
  session_timeout_minutes INT DEFAULT 480,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES agent_access_roles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL,
  subject_type VARCHAR(50) NOT NULL CHECK (subject_type IN ('agent','user','service','group','api_key','token')),
  granted_by UUID,
  grant_type VARCHAR(50) NOT NULL DEFAULT 'permanent' CHECK (grant_type IN ('permanent','temporary','scheduled','conditional','emergency')),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_access_policies_agent ON agent_access_policies(agent_id);
CREATE INDEX idx_agent_access_roles_policy ON agent_access_roles(policy_id);
CREATE INDEX idx_agent_access_grants_role ON agent_access_grants(role_id);
CREATE INDEX idx_agent_access_grants_subject ON agent_access_grants(subject_id);
CREATE INDEX idx_agent_access_policies_status ON agent_access_policies(status);

COMMIT;
