-- Batch 312: Config Manager vertical
CREATE TABLE IF NOT EXISTS agent_config_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  store_type TEXT NOT NULL DEFAULT 'etcd' CHECK (store_type IN ('etcd','consul','vault','file','env')),
  encryption_enabled BOOLEAN NOT NULL DEFAULT true,
  version_history INTEGER NOT NULL DEFAULT 50,
  watch_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_config_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_config_mgr_configs(id),
  key_path TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','number','boolean','json','secret')),
  version INTEGER NOT NULL DEFAULT 1,
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES agent_config_entries(id),
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID,
  change_reason TEXT,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_mgr_configs_agent ON agent_config_mgr_configs(agent_id);
CREATE INDEX idx_config_entries_config ON agent_config_entries(config_id);
CREATE INDEX idx_config_entries_key ON agent_config_entries(key_path);
CREATE INDEX idx_config_history_entry ON agent_config_history(entry_id);
