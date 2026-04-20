-- Batch 404: Pipeline Scheduler
-- Schedules and manages recurring/one-time pipeline executions with cron and dependency triggers

CREATE TABLE IF NOT EXISTS agent_pipeline_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  max_concurrent_pipelines INTEGER NOT NULL DEFAULT 5,
  catchup_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_pipeline_scheduler_configs(id),
  name TEXT NOT NULL,
  description TEXT,
  schedule_cron TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'cron', 'event', 'dependency', 'webhook')),
  pipeline_definition JSONB NOT NULL,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_pipelines(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  trigger_reason TEXT,
  input_params JSONB,
  output_data JSONB,
  duration_ms INTEGER,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_pipelines_config ON agent_pipelines(config_id);
CREATE INDEX idx_agent_pipelines_next_run ON agent_pipelines(next_run_at) WHERE enabled = true;
CREATE INDEX idx_agent_pipeline_runs_pipeline ON agent_pipeline_runs(pipeline_id);
CREATE INDEX idx_agent_pipeline_runs_status ON agent_pipeline_runs(status);
