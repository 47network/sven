-- Batch 283: Pipeline Runner
CREATE TABLE IF NOT EXISTS agent_pipeline_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pipeline_type TEXT NOT NULL DEFAULT 'ci',
  source_repo TEXT,
  trigger_events JSONB DEFAULT '["push","merge_request"]',
  timeout_minutes INTEGER DEFAULT 60,
  max_concurrent INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_pipeline_configs(id),
  run_number INTEGER NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  commit_sha TEXT,
  branch TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  stages JSONB DEFAULT '[]',
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_pipeline_runs(id),
  stage_name TEXT NOT NULL,
  stage_index INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  logs TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_pipeline_configs_agent ON agent_pipeline_configs(agent_id);
CREATE INDEX idx_pipeline_runs_config ON agent_pipeline_runs(config_id);
CREATE INDEX idx_pipeline_stages_run ON agent_pipeline_stages(run_id);
