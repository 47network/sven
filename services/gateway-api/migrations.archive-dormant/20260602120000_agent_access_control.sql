-- Batch 60 — Agent Access Control & Permissions
-- Role-based and attribute-based access control for autonomous agents,
-- permission grants, policy rules, access audit trails, and scope definitions.

CREATE TABLE IF NOT EXISTS agent_roles (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  role_name     TEXT NOT NULL,
  role_type     TEXT NOT NULL CHECK (role_type IN ('system','custom','inherited','temporary','delegated')),
  permissions   JSONB DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  granted_by    TEXT,
  expires_at    TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  resource      TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('read','write','execute','delete','admin')),
  effect        TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
  conditions    JSONB DEFAULT '{}'::jsonb,
  granted_by    TEXT,
  expires_at    TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_access_policies (
  id            TEXT PRIMARY KEY,
  policy_name   TEXT NOT NULL,
  policy_type   TEXT NOT NULL CHECK (policy_type IN ('rbac','abac','pbac','mandatory','discretionary')),
  priority      INTEGER NOT NULL DEFAULT 100,
  rules         JSONB DEFAULT '[]'::jsonb,
  target_agents JSONB DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  evaluated_at  TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_access_audit (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  resource      TEXT NOT NULL,
  action        TEXT NOT NULL,
  decision      TEXT NOT NULL CHECK (decision IN ('granted','denied','escalated','revoked','expired')),
  policy_id     TEXT REFERENCES agent_access_policies(id),
  reason        TEXT,
  ip_address    TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_scopes (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  scope_name    TEXT NOT NULL,
  scope_type    TEXT NOT NULL CHECK (scope_type IN ('api','data','service','resource','delegation')),
  boundaries    JSONB DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  granted_by    TEXT,
  expires_at    TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (17)
CREATE INDEX idx_agent_roles_agent ON agent_roles(agent_id);
CREATE INDEX idx_agent_roles_type ON agent_roles(role_type);
CREATE INDEX idx_agent_roles_active ON agent_roles(is_active);
CREATE INDEX idx_agent_roles_expires ON agent_roles(expires_at);
CREATE INDEX idx_permissions_agent ON agent_permissions(agent_id);
CREATE INDEX idx_permissions_resource ON agent_permissions(resource);
CREATE INDEX idx_permissions_action ON agent_permissions(action);
CREATE INDEX idx_permissions_effect ON agent_permissions(effect);
CREATE INDEX idx_access_policies_type ON agent_access_policies(policy_type);
CREATE INDEX idx_access_policies_active ON agent_access_policies(is_active);
CREATE INDEX idx_access_policies_priority ON agent_access_policies(priority);
CREATE INDEX idx_access_audit_agent ON agent_access_audit(agent_id);
CREATE INDEX idx_access_audit_decision ON agent_access_audit(decision);
CREATE INDEX idx_access_audit_created ON agent_access_audit(created_at);
CREATE INDEX idx_scopes_agent ON agent_scopes(agent_id);
CREATE INDEX idx_scopes_type ON agent_scopes(scope_type);
CREATE INDEX idx_scopes_active ON agent_scopes(is_active);
