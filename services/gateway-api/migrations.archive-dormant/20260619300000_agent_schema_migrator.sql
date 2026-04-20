-- Batch 293: Schema Migrator
CREATE TABLE IF NOT EXISTS agent_schema_mig_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  db_type TEXT NOT NULL DEFAULT 'postgresql',
  migrations_dir TEXT DEFAULT 'migrations',
  auto_apply BOOLEAN DEFAULT false,
  lock_timeout_seconds INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_schema_mig_configs(id),
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'up',
  state TEXT NOT NULL DEFAULT 'pending',
  checksum TEXT,
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_schema_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_schema_mig_configs(id),
  from_version TEXT,
  to_version TEXT,
  diff_sql TEXT NOT NULL,
  tables_affected JSONB DEFAULT '[]',
  breaking BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_schema_mig_configs_agent ON agent_schema_mig_configs(agent_id);
CREATE INDEX idx_schema_migrations_config ON agent_schema_migrations(config_id);
CREATE INDEX idx_schema_diffs_config ON agent_schema_diffs(config_id);
