-- Batch 410: Config Registry
-- Centralized configuration management with versioning, environments, and hot-reload

CREATE TABLE IF NOT EXISTS agent_config_registry_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_environment TEXT NOT NULL DEFAULT 'production',
  encryption_enabled BOOLEAN NOT NULL DEFAULT true,
  version_retention INTEGER NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_config_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_config_registry_configs(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'secret')),
  environment TEXT NOT NULL DEFAULT 'production',
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(config_id, key, environment, version)
);

CREATE TABLE IF NOT EXISTS agent_config_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES agent_config_entries(id),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_config_entries_config ON agent_config_entries(config_id);
CREATE INDEX idx_agent_config_entries_key ON agent_config_entries(config_id, key, environment) WHERE is_current = true;
CREATE INDEX idx_agent_config_change_log_entry ON agent_config_change_log(entry_id);
