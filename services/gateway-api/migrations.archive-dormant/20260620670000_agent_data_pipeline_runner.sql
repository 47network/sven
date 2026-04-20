-- Batch 430: Data Pipeline Runner
CREATE TABLE IF NOT EXISTS agent_data_pipeline_runner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_pipelines INTEGER NOT NULL DEFAULT 5,
  default_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  retry_policy TEXT NOT NULL DEFAULT 'exponential' CHECK (retry_policy IN ('none','fixed','exponential','linear')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_pipeline_runner_configs(id),
  name TEXT NOT NULL,
  dag JSONB NOT NULL,
  schedule TEXT,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','failed','completed')),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_pipelines(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  steps_total INTEGER NOT NULL DEFAULT 0,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  output JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_data_pipeline_runner_configs_agent ON agent_data_pipeline_runner_configs(agent_id);
CREATE INDEX idx_agent_pipelines_config ON agent_pipelines(config_id);
CREATE INDEX idx_agent_pipeline_runs_pipeline ON agent_pipeline_runs(pipeline_id);
