-- Backups & Disaster Recovery Migration
-- Supports nightly DB backups, weekly snapshots, monthly archives, and restore procedures

-- Backup job configuration
CREATE TABLE IF NOT EXISTS backup_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Backup settings
  backup_type VARCHAR(50) NOT NULL, -- full, incremental, differential
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Scheduling
  schedule_cron TEXT NOT NULL, -- "0 2 * * *" for daily at 2am
  retention_days INTEGER DEFAULT 30,
  
  -- Storage location
  storage_path VARCHAR(500), -- /nas/backups or s3://bucket/backups
  storage_type VARCHAR(50) DEFAULT 'nas', -- nas, s3, azure, gcs
  
  -- Compression
  compression_enabled BOOLEAN DEFAULT true,
  compression_algorithm VARCHAR(20) DEFAULT 'gzip', -- gzip, bzip2, zstd
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT,
  
  INDEX idx_backup_config_enabled ON backup_config(enabled)
);

-- Backup jobs (individual backup executions)
CREATE TABLE IF NOT EXISTS backup_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  backup_config_id TEXT REFERENCES backup_config(id) ON DELETE CASCADE,
  
  -- Job status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, verified
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Results
  total_size_bytes BIGINT,
  compressed_size_bytes BIGINT,
  backup_location VARCHAR(500),
  backup_file_hash VARCHAR(64), -- SHA256
  
  -- Metadata
  database_version TEXT,
  record_count BIGINT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Verification
  verified_at TIMESTAMP,
  verified_by TEXT,
  verification_result TEXT, -- passed, failed, warning
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_backup_jobs_status ON backup_jobs(status),
  INDEX idx_backup_jobs_completed_at ON backup_jobs(completed_at DESC),
  INDEX idx_backup_jobs_config_id ON backup_jobs(backup_config_id)
);

-- Snapshot jobs (point-in-time snapshots for faster restore)
CREATE TABLE IF NOT EXISTS snapshot_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Timing
  snapshot_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Location
  snapshot_location VARCHAR(500),
  snapshot_size_bytes BIGINT,
  
  -- Metadata
  backup_job_id TEXT REFERENCES backup_jobs(id) ON DELETE SET NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) DEFAULT 'available', -- available, expired, archived
  expiration_date TIMESTAMP,
  archived_at TIMESTAMP,
  
  INDEX idx_snapshot_time ON snapshot_jobs(snapshot_time DESC),
  INDEX idx_snapshot_status ON snapshot_jobs(status)
);

-- Archive jobs (long-term storage for compliance)
CREATE TABLE IF NOT EXISTS archive_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Source
  backup_job_id TEXT REFERENCES backup_jobs(id) ON DELETE SET NULL,
  
  -- Timing
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Location
  archive_location VARCHAR(500), -- cold storage
  archive_size_bytes BIGINT,
  archive_format VARCHAR(50), -- tar, tar.gz, zip
  
  -- Retention
  retention_years INTEGER DEFAULT 7,
  compliance_category VARCHAR(50), -- financial, medical, personal, audit
  retention_reason TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, archiving, completed, restored
  error_message TEXT,
  
  -- Verification
  archive_hash VARCHAR(64), -- SHA256
  last_verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_archive_status ON archive_jobs(status),
  INDEX idx_archive_compliance ON archive_jobs(compliance_category)
);

-- Restore jobs (track all restore operations)
CREATE TABLE IF NOT EXISTS restore_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Source and target
  backup_job_id TEXT NOT NULL REFERENCES backup_jobs(id) ON DELETE RESTRICT,
  target_environment VARCHAR(50) NOT NULL, -- production, staging, dev
  target_host VARCHAR(255),
  
  -- Timing
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, verified
  
  -- Restoration details
  recovery_point_objective TIMESTAMP, -- target recovery time
  recovery_time_objective INTEGER, -- target RTO in minutes
  
  -- Results
  records_restored BIGINT,
  data_verification_passed BOOLEAN,
  verification_details JSONB,
  
  -- Metadata
  initiated_by TEXT NOT NULL,
  reason TEXT,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_restore_status ON restore_jobs(status),
  INDEX idx_restore_target_env ON restore_jobs(target_environment),
  INDEX idx_restore_completed_at ON restore_jobs(completed_at DESC)
);

-- Disaster recovery drill checklist
CREATE TABLE IF NOT EXISTS dr_drills (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Drill metadata
  name TEXT NOT NULL,
  description TEXT,
  iteration INTEGER DEFAULT 1, -- Quarterly drill #
  
  -- Timing
  scheduled_date TIMESTAMP,
  drill_date TIMESTAMP,
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  
  -- Scope
  scope VARCHAR(50) NOT NULL, -- full_restore, partial_restore, failover_test, failback_test
  affected_systems TEXT[] NOT NULL, -- ['postgres', 'opensearch', 'nats', ...]
  
  -- Status & Results
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, failed
  success BOOLEAN,
  findings TEXT,
  recommendations TEXT,
  
  -- Participants
  lead_person TEXT,
  participants TEXT[],
  observers TEXT[],
  
  -- Execution tracking
  checklist_items JSONB, -- {"item": "status"}
  issues_found TEXT[],
  data_integrity_verified BOOLEAN,
  
  -- Follow-up
  action_items JSONB,
  next_drill_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_dr_drills_status ON dr_drills(status),
  INDEX idx_dr_drills_scheduled_date ON dr_drills(scheduled_date DESC)
);

-- Backup & restore audit log
CREATE TABLE IF NOT EXISTS backup_audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Action
  action_type VARCHAR(50), -- backup_started, backup_completed, restore_started, restore_completed, verification, archive
  resource_type VARCHAR(50), -- backup_job, restore_job, snapshot, archive
  resource_id TEXT,
  
  -- Actor
  actor_user_id TEXT,
  actor_role VARCHAR(50),
  
  -- Details
  details JSONB,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_backup_audit_action ON backup_audit_log(action_type),
  INDEX idx_backup_audit_created_at ON backup_audit_log(created_at DESC)
);

-- Backup status summary (for Admin UI dashboard)
CREATE TABLE IF NOT EXISTS backup_status (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Latest backup
  latest_backup_job_id TEXT REFERENCES backup_jobs(id),
  latest_backup_time TIMESTAMP,
  latest_backup_status VARCHAR(50),
  latest_backup_size_bytes BIGINT,
  
  -- Latest snapshot
  latest_snapshot_id TEXT REFERENCES snapshot_jobs(id),
  latest_snapshot_time TIMESTAMP,
  
  -- Latest archive
  latest_archive_job_id TEXT REFERENCES archive_jobs(id),
  latest_archive_time TIMESTAMP,
  
  -- Health metrics
  days_since_last_successful_backup INTEGER,
  backup_success_rate DECIMAL(5,2), -- percentage
  restore_test_passed BOOLEAN,
  restore_test_date TIMESTAMP,
  
  -- Alerts
  backup_health_status VARCHAR(50), -- healthy, warning, critical
  alert_message TEXT,
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_backup_status_updated ON backup_status(updated_at DESC)
);

-- Insert default backup configuration (daily at 2am, 30-day retention)
INSERT INTO backup_config (id, backup_type, enabled, schedule_cron, retention_days, storage_path, storage_type)
VALUES ('default-daily-backup', 'incremental', true, '0 2 * * *', 30, '/nas/backups/daily', 'nas')
ON CONFLICT DO NOTHING;

-- Insert default snapshot configuration (weekly on Sunday)
INSERT INTO backup_config (id, backup_type, enabled, schedule_cron, retention_days, storage_path, storage_type)
VALUES ('default-weekly-snapshot', 'full', true, '0 3 * * 0', 90, '/nas/backups/snapshots', 'nas')
ON CONFLICT DO NOTHING;

-- Insert default archive configuration (monthly, 7-year retention)
INSERT INTO backup_config (id, backup_type, enabled, schedule_cron, retention_days, storage_path, storage_type)
VALUES ('default-monthly-archive', 'full', true, '0 4 1 * *', 2555, '/nas/archive', 'nas')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_jobs_config_status ON backup_jobs(backup_config_id, status);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_backup_id ON restore_jobs(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_backup_id ON snapshot_jobs(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_archive_backup_id ON archive_jobs(backup_job_id);
