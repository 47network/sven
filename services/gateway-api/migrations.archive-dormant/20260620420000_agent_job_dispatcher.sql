-- Batch 405: Job Dispatcher
-- Distributes and tracks individual job units across agent workers with priority and routing

CREATE TABLE IF NOT EXISTS agent_job_dispatcher_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_workers INTEGER NOT NULL DEFAULT 10,
  dispatch_strategy TEXT NOT NULL DEFAULT 'round_robin' CHECK (dispatch_strategy IN ('round_robin', 'least_loaded', 'priority', 'affinity', 'random')),
  default_priority INTEGER NOT NULL DEFAULT 5,
  job_timeout_seconds INTEGER NOT NULL DEFAULT 300,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_job_dispatcher_configs(id),
  job_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'running', 'completed', 'failed', 'retrying', 'dead_letter')),
  assigned_worker_id UUID,
  payload JSONB NOT NULL,
  result JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error TEXT,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_job_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_job_dispatcher_configs(id),
  worker_agent_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'offline', 'draining')),
  capabilities JSONB NOT NULL DEFAULT '[]',
  current_load INTEGER NOT NULL DEFAULT 0,
  max_load INTEGER NOT NULL DEFAULT 5,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_jobs_config ON agent_jobs(config_id);
CREATE INDEX idx_agent_jobs_status_priority ON agent_jobs(status, priority DESC);
CREATE INDEX idx_agent_job_workers_config ON agent_job_workers(config_id);
CREATE INDEX idx_agent_job_workers_status ON agent_job_workers(status);
