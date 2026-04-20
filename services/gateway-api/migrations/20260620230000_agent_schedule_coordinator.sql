CREATE TABLE IF NOT EXISTS agent_schedule_coordinator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 10,
  overlap_policy TEXT NOT NULL DEFAULT 'skip',
  heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_schedule_coordinator_configs(id),
  agent_id UUID NOT NULL,
  job_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'task',
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_scheduled_jobs(id),
  execution_status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result_data JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_agent ON agent_scheduled_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON agent_scheduled_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_job_executions_job ON agent_job_executions(job_id);
