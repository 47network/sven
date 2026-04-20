-- Batch 212: config_server
CREATE TABLE IF NOT EXISTS agent_config_namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  environment VARCHAR(50) NOT NULL DEFAULT 'production' CHECK (environment IN ('development','staging','production','canary','test')),
  encryption_enabled BOOLEAN DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','archived','migrating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, name, environment)
);

CREATE TABLE IF NOT EXISTS agent_config_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL REFERENCES agent_config_namespaces(id),
  key VARCHAR(500) NOT NULL,
  value TEXT NOT NULL,
  value_type VARCHAR(30) NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','number','boolean','json','secret','url','duration','bytes')),
  is_secret BOOLEAN DEFAULT false,
  description TEXT,
  validation_regex VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace_id, key)
);

CREATE TABLE IF NOT EXISTS agent_config_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES agent_config_entries(id),
  previous_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(255) NOT NULL,
  change_reason TEXT,
  rollback_of UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_namespaces_agent ON agent_config_namespaces(agent_id);
CREATE INDEX idx_config_namespaces_env ON agent_config_namespaces(environment);
CREATE INDEX idx_config_entries_namespace ON agent_config_entries(namespace_id);
CREATE INDEX idx_config_entries_key ON agent_config_entries(key);
CREATE INDEX idx_config_change_log_entry ON agent_config_change_log(entry_id);
CREATE INDEX idx_config_change_log_time ON agent_config_change_log(created_at);
