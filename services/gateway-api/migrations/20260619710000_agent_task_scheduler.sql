CREATE TABLE IF NOT EXISTS agent_task_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  max_concurrent_jobs INT DEFAULT 10,
  retry_on_failure BOOLEAN DEFAULT true,
  max_retries INT DEFAULT 3,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_task_scheduler_configs(id),
  name VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  task_type VARCHAR(100) NOT NULL,
  task_payload JSONB DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','paused','expired','completed')),
  run_count INT DEFAULT 0,
  max_runs INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_scheduled_jobs(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_task_scheduler_agent ON agent_task_scheduler_configs(agent_id);
CREATE INDEX idx_scheduled_jobs_config ON agent_scheduled_jobs(config_id);
CREATE INDEX idx_scheduled_jobs_next ON agent_scheduled_jobs(next_run_at);
CREATE INDEX idx_job_runs_job ON agent_job_runs(job_id);
CREATE INDEX idx_job_runs_status ON agent_job_runs(status);
