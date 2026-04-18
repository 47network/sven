-- Batch 77: Agent Multi-Tenancy
-- Tenant isolation, quota management and cross-tenant collaboration

CREATE TABLE IF NOT EXISTS tenants (
  id           TEXT PRIMARY KEY,
  tenant_name  TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  owner_id     TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise','custom')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','cancelled')),
  max_agents   INTEGER NOT NULL DEFAULT 5,
  max_storage_mb INTEGER NOT NULL DEFAULT 500,
  metadata     JSONB NOT NULL DEFAULT '{}',
  trial_ends_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_members (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer','billing')),
  permissions JSONB NOT NULL DEFAULT '[]',
  invited_by  TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','removed')),
  metadata    JSONB NOT NULL DEFAULT '{}',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('agents','tasks','storage_mb','api_calls','llm_tokens','bandwidth_mb')),
  quota_limit   NUMERIC(18,4) NOT NULL DEFAULT 0,
  current_usage NUMERIC(18,4) NOT NULL DEFAULT 0,
  reset_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (reset_period IN ('hourly','daily','weekly','monthly','never')),
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT UNIQUE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  invited_by  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id TEXT,
  details     JSONB NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);
CREATE INDEX idx_tenants_plan ON tenants(plan);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_role ON tenant_members(role);
CREATE INDEX idx_tenant_members_status ON tenant_members(status);
CREATE INDEX idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
CREATE INDEX idx_tenant_quotas_resource ON tenant_quotas(resource_type);
CREATE INDEX idx_tenant_quotas_reset ON tenant_quotas(reset_period);
CREATE INDEX idx_tenant_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON tenant_invitations(email);
CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_tenant_invitations_status ON tenant_invitations(status);
CREATE INDEX idx_tenant_invitations_expires ON tenant_invitations(expires_at);
CREATE INDEX idx_tenant_audit_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX idx_tenant_audit_actor ON tenant_audit_log(actor_id);
CREATE INDEX idx_tenant_audit_action ON tenant_audit_log(action);
CREATE INDEX idx_tenant_audit_created ON tenant_audit_log(created_at);
