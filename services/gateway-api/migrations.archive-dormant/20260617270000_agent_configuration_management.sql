-- Batch 90: Agent Configuration Management
-- Centralized config store, namespaces, versioning, validation, and audit

CREATE TABLE IF NOT EXISTS config_namespaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id TEXT REFERENCES config_namespaces(id),
  owner_agent_id TEXT,
  is_sealed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_entries (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL REFERENCES config_namespaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','number','boolean','json','secret','list','map')),
  version INTEGER NOT NULL DEFAULT 1,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  validation_schema JSONB,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace_id, key)
);

CREATE TABLE IF NOT EXISTS config_versions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES config_entries(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_by TEXT,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, version)
);

CREATE TABLE IF NOT EXISTS config_schemas (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL REFERENCES config_namespaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  is_strict BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_audit_log (
  id TEXT PRIMARY KEY,
  entry_id TEXT REFERENCES config_entries(id) ON DELETE SET NULL,
  namespace_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','read','rollback','seal','unseal')),
  actor TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cn_name ON config_namespaces(name);
CREATE INDEX idx_cn_parent ON config_namespaces(parent_id);
CREATE INDEX idx_cn_owner ON config_namespaces(owner_agent_id);
CREATE INDEX idx_cn_sealed ON config_namespaces(is_sealed) WHERE is_sealed = true;
CREATE INDEX idx_ce_namespace ON config_entries(namespace_id);
CREATE INDEX idx_ce_key ON config_entries(key);
CREATE INDEX idx_ce_type ON config_entries(value_type);
CREATE INDEX idx_ce_encrypted ON config_entries(is_encrypted) WHERE is_encrypted = true;
CREATE INDEX idx_ce_version ON config_entries(version DESC);
CREATE INDEX idx_cv_entry ON config_versions(entry_id);
CREATE INDEX idx_cv_version ON config_versions(entry_id, version DESC);
CREATE INDEX idx_cv_changed_by ON config_versions(changed_by);
CREATE INDEX idx_cv_created ON config_versions(created_at DESC);
CREATE INDEX idx_cs_namespace ON config_schemas(namespace_id);
CREATE INDEX idx_cs_name ON config_schemas(name);
CREATE INDEX idx_cal_entry ON config_audit_log(entry_id);
CREATE INDEX idx_cal_namespace ON config_audit_log(namespace_id);
CREATE INDEX idx_cal_action ON config_audit_log(action);
CREATE INDEX idx_cal_actor ON config_audit_log(actor);
CREATE INDEX idx_cal_created ON config_audit_log(created_at DESC);
