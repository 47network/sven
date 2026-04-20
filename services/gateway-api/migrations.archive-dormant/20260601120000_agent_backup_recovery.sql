-- Batch 59 — Agent Backup & Recovery
-- Automated backup scheduling, snapshot management, recovery points,
-- retention policies, and disaster recovery for autonomous agents.

CREATE TABLE IF NOT EXISTS agent_backup_jobs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  backup_type   TEXT NOT NULL CHECK (backup_type IN ('full','incremental','differential','snapshot','selective')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  source_path   TEXT,
  destination   TEXT,
  size_bytes    BIGINT DEFAULT 0,
  checksum      TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_recovery_points (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  backup_job_id     TEXT REFERENCES agent_backup_jobs(id),
  recovery_type     TEXT NOT NULL CHECK (recovery_type IN ('full','partial','point_in_time','granular','cross_region')),
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','restoring','restored','expired','corrupted')),
  snapshot_data     JSONB DEFAULT '{}'::jsonb,
  restore_target    TEXT,
  restored_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_retention_policies (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  policy_name       TEXT NOT NULL,
  retention_days    INTEGER NOT NULL DEFAULT 30,
  max_backups       INTEGER DEFAULT 100,
  backup_type       TEXT NOT NULL CHECK (backup_type IN ('full','incremental','differential','snapshot','selective')),
  schedule_cron     TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_applied_at   TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_disaster_recovery_plans (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  plan_name         TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical','emergency')),
  rto_minutes       INTEGER NOT NULL DEFAULT 60,
  rpo_minutes       INTEGER NOT NULL DEFAULT 15,
  failover_target   TEXT,
  steps             JSONB DEFAULT '[]'::jsonb,
  last_tested_at    TIMESTAMPTZ,
  test_result       TEXT CHECK (test_result IS NULL OR test_result IN ('passed','failed','partial','skipped')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_restore_logs (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  recovery_point_id TEXT REFERENCES agent_recovery_points(id),
  dr_plan_id        TEXT REFERENCES agent_disaster_recovery_plans(id),
  restore_type      TEXT NOT NULL CHECK (restore_type IN ('manual','automatic','scheduled','dr_failover','test')),
  status            TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_progress','completed','failed','rolled_back')),
  items_restored    INTEGER DEFAULT 0,
  items_failed      INTEGER DEFAULT 0,
  duration_ms       BIGINT DEFAULT 0,
  error_log         TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (17)
CREATE INDEX idx_backup_jobs_agent ON agent_backup_jobs(agent_id);
CREATE INDEX idx_backup_jobs_status ON agent_backup_jobs(status);
CREATE INDEX idx_backup_jobs_type ON agent_backup_jobs(backup_type);
CREATE INDEX idx_backup_jobs_created ON agent_backup_jobs(created_at);
CREATE INDEX idx_recovery_points_agent ON agent_recovery_points(agent_id);
CREATE INDEX idx_recovery_points_status ON agent_recovery_points(status);
CREATE INDEX idx_recovery_points_backup ON agent_recovery_points(backup_job_id);
CREATE INDEX idx_recovery_points_expires ON agent_recovery_points(expires_at);
CREATE INDEX idx_retention_policies_agent ON agent_retention_policies(agent_id);
CREATE INDEX idx_retention_policies_active ON agent_retention_policies(is_active);
CREATE INDEX idx_retention_policies_type ON agent_retention_policies(backup_type);
CREATE INDEX idx_dr_plans_agent ON agent_disaster_recovery_plans(agent_id);
CREATE INDEX idx_dr_plans_priority ON agent_disaster_recovery_plans(priority);
CREATE INDEX idx_dr_plans_active ON agent_disaster_recovery_plans(is_active);
CREATE INDEX idx_restore_logs_agent ON agent_restore_logs(agent_id);
CREATE INDEX idx_restore_logs_status ON agent_restore_logs(status);
CREATE INDEX idx_restore_logs_type ON agent_restore_logs(restore_type);
