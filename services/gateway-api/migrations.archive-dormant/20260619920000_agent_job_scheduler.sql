-- Batch 355: Job Scheduler — distributed job scheduling and execution
CREATE TABLE IF NOT EXISTS agent_job_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  scheduler_type TEXT NOT NULL DEFAULT 'cron' CHECK (scheduler_type IN ('cron','interval','once','event_driven','dependency')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  retry_policy TEXT NOT NULL DEFAULT 'exponential' CHECK (retry_policy IN ('none','fixed','exponential','linear')),
  max_retries INTEGER NOT NULL DEFAULT 3,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_scheduler_configs_agent ON agent_job_scheduler_configs(agent_id);

CREATE TABLE IF NOT EXISTS agent_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_job_scheduler_configs(id),
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  schedule_expression TEXT,
  job_payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','running','completed','failed','cancelled','paused')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  timeout_seconds INTEGER NOT NULL DEFAULT 300,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_jobs_config ON agent_scheduled_jobs(config_id);
CREATE INDEX idx_scheduled_jobs_next_run ON agent_scheduled_jobs(next_run_at);
CREATE INDEX idx_scheduled_jobs_status ON agent_scheduled_jobs(status);

CREATE TABLE IF NOT EXISTS agent_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_scheduled_jobs(id),
  execution_status TEXT NOT NULL DEFAULT 'running' CHECK (execution_status IN ('running','completed','failed','timeout','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result JSONB,
  error_message TEXT,
  retry_attempt INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_executions_job ON agent_job_executions(job_id);
