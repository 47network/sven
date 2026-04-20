-- Batch 357: Data Migrator — data migration planning and execution
CREATE TABLE IF NOT EXISTS agent_data_migrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'postgresql' CHECK (source_type IN ('postgresql','mysql','mongodb','elasticsearch','csv','json','api')),
  target_type TEXT NOT NULL DEFAULT 'postgresql' CHECK (target_type IN ('postgresql','mysql','mongodb','elasticsearch','csv','json','api')),
  migration_mode TEXT NOT NULL DEFAULT 'full' CHECK (migration_mode IN ('full','incremental','differential','cdc')),
  batch_size INTEGER NOT NULL DEFAULT 1000,
  parallel_workers INTEGER NOT NULL DEFAULT 4,
  validation_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_migrator_configs_agent ON agent_data_migrator_configs(agent_id);

CREATE TABLE IF NOT EXISTS agent_migration_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_migrator_configs(id),
  plan_name TEXT NOT NULL,
  source_schema JSONB NOT NULL DEFAULT '{}',
  target_schema JSONB NOT NULL DEFAULT '{}',
  field_mappings JSONB NOT NULL DEFAULT '[]',
  transformations JSONB DEFAULT '[]',
  estimated_rows BIGINT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','running','completed','failed','rolled_back')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_migration_plans_config ON agent_migration_plans(config_id);
CREATE INDEX idx_migration_plans_status ON agent_migration_plans(status);

CREATE TABLE IF NOT EXISTS agent_migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES agent_migration_plans(id),
  run_status TEXT NOT NULL DEFAULT 'pending' CHECK (run_status IN ('pending','extracting','transforming','loading','validating','completed','failed','rolled_back')),
  rows_extracted BIGINT NOT NULL DEFAULT 0,
  rows_transformed BIGINT NOT NULL DEFAULT 0,
  rows_loaded BIGINT NOT NULL DEFAULT 0,
  rows_failed BIGINT NOT NULL DEFAULT 0,
  validation_errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_migration_runs_plan ON agent_migration_runs(plan_id);
