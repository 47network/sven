-- Batch 111 — Agent Backup Scheduling
-- Backup schedules, snapshots, restore jobs

CREATE TABLE IF NOT EXISTS agent_backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  schedule_name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  retention_days INT NOT NULL DEFAULT 30,
  storage_backend VARCHAR(100) NOT NULL DEFAULT 's3',
  compression VARCHAR(30) NOT NULL DEFAULT 'gzip',
  encryption_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_backup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  schedule_id UUID NOT NULL REFERENCES agent_backup_schedules(id) ON DELETE CASCADE,
  snapshot_key VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum VARCHAR(128),
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_backup_restore_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES agent_backup_snapshots(id) ON DELETE CASCADE,
  target_resource_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  progress_pct INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_agent ON agent_backup_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_resource ON agent_backup_schedules(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_schedule ON agent_backup_snapshots(schedule_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_agent ON agent_backup_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_status ON agent_backup_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_backup_restore_snapshot ON agent_backup_restore_jobs(snapshot_id);
