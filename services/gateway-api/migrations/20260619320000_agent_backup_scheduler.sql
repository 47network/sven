-- Batch 295: Backup Scheduler
CREATE TABLE IF NOT EXISTS agent_backup_sched_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'full',
  schedule_cron TEXT DEFAULT '0 2 * * *',
  retention_count INTEGER DEFAULT 7,
  storage_path TEXT,
  compression BOOLEAN DEFAULT true,
  encryption BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_backup_sched_configs(id),
  backup_type TEXT NOT NULL DEFAULT 'full',
  size_bytes BIGINT,
  duration_seconds INTEGER,
  state TEXT NOT NULL DEFAULT 'running',
  storage_path TEXT,
  checksum TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_backup_restores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID NOT NULL REFERENCES agent_backup_runs(id),
  target_db TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'restoring',
  point_in_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_backup_sched_configs_agent ON agent_backup_sched_configs(agent_id);
CREATE INDEX idx_backup_runs_config ON agent_backup_runs(config_id);
CREATE INDEX idx_backup_restores_backup ON agent_backup_restores(backup_id);
