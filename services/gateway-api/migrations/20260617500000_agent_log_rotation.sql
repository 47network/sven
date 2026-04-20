-- Batch 113: Agent Log Rotation
-- Provides automated log lifecycle management, retention policies, and archive storage

CREATE TABLE IF NOT EXISTS agent_log_rotation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  log_source TEXT NOT NULL,
  rotation_interval TEXT NOT NULL DEFAULT '24h',
  max_file_size_mb INT NOT NULL DEFAULT 100,
  retention_days INT NOT NULL DEFAULT 30,
  compression TEXT NOT NULL DEFAULT 'gzip',
  archive_backend TEXT NOT NULL DEFAULT 's3',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_log_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_log_rotation_policies(id),
  agent_id UUID NOT NULL,
  archive_path TEXT NOT NULL,
  original_size_bytes BIGINT NOT NULL,
  compressed_size_bytes BIGINT NOT NULL,
  log_start_time TIMESTAMPTZ NOT NULL,
  log_end_time TIMESTAMPTZ NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_log_retention_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_log_rotation_policies(id),
  agent_id UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'purge',
  archives_processed INT NOT NULL DEFAULT 0,
  bytes_reclaimed BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_rotation_policies_agent ON agent_log_rotation_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_log_rotation_policies_source ON agent_log_rotation_policies(log_source);
CREATE INDEX IF NOT EXISTS idx_log_archives_policy ON agent_log_archives(policy_id);
CREATE INDEX IF NOT EXISTS idx_log_archives_agent ON agent_log_archives(agent_id);
CREATE INDEX IF NOT EXISTS idx_log_archives_status ON agent_log_archives(status);
CREATE INDEX IF NOT EXISTS idx_log_retention_jobs_policy ON agent_log_retention_jobs(policy_id);
