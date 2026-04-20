-- Batch 70: Agent Environment Configuration
-- Environment variables, config profiles, secret injection, and runtime configuration management

CREATE TABLE IF NOT EXISTS env_profiles (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  name            TEXT NOT NULL,
  environment     TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('development','staging','production','testing')),
  description     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS env_variables (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES env_profiles(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value           TEXT,
  is_secret       BOOLEAN NOT NULL DEFAULT false,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','vault','env_file','inherited','computed')),
  override_of     TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, key)
);

CREATE TABLE IF NOT EXISTS config_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  variables       JSONB NOT NULL DEFAULT '[]',
  defaults        JSONB NOT NULL DEFAULT '{}',
  required_keys   JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config_snapshots (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES env_profiles(id) ON DELETE CASCADE,
  snapshot_data   JSONB NOT NULL DEFAULT '{}',
  reason          TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config_audit_log (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES env_profiles(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('created','updated','deleted','rotated','exported','imported')),
  variable_key    TEXT,
  old_value_hash  TEXT,
  new_value_hash  TEXT,
  performed_by    TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_env_profiles_agent ON env_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_env_profiles_env ON env_profiles(environment);
CREATE INDEX IF NOT EXISTS idx_env_profiles_default ON env_profiles(is_default);
CREATE INDEX IF NOT EXISTS idx_env_variables_profile ON env_variables(profile_id);
CREATE INDEX IF NOT EXISTS idx_env_variables_key ON env_variables(key);
CREATE INDEX IF NOT EXISTS idx_env_variables_secret ON env_variables(is_secret);
CREATE INDEX IF NOT EXISTS idx_env_variables_source ON env_variables(source);
CREATE INDEX IF NOT EXISTS idx_config_templates_name ON config_templates(name);
CREATE INDEX IF NOT EXISTS idx_config_templates_created ON config_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_config_snapshots_profile ON config_snapshots(profile_id);
CREATE INDEX IF NOT EXISTS idx_config_snapshots_created ON config_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_config_snapshots_reason ON config_snapshots(reason);
CREATE INDEX IF NOT EXISTS idx_config_audit_profile ON config_audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_action ON config_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_config_audit_key ON config_audit_log(variable_key);
CREATE INDEX IF NOT EXISTS idx_config_audit_performer ON config_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_config_audit_created ON config_audit_log(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_env_profiles_agent_default ON env_profiles(agent_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_env_variables_override ON env_variables(override_of);
