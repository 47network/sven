-- Batch 399: Permission Engine — fine-grained permission evaluation
CREATE TABLE IF NOT EXISTS agent_permission_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  evaluation_strategy TEXT NOT NULL DEFAULT 'most_specific',
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  wildcard_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_permission_engine_configs(id),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  conditions JSONB DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_permission_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_permission_engine_configs(id),
  subject TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  matched_permission_id UUID REFERENCES agent_permissions(id),
  evaluation_ms INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perm_engine_agent ON agent_permission_engine_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_permissions_config ON agent_permissions(config_id);
CREATE INDEX IF NOT EXISTS idx_perm_checks_config ON agent_permission_checks(config_id);
