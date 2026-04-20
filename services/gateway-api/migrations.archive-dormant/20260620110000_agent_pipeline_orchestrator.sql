CREATE TABLE IF NOT EXISTS agent_pipeline_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_pipelines INTEGER NOT NULL DEFAULT 5,
  default_timeout_seconds INTEGER NOT NULL DEFAULT 3600,
  retry_policy TEXT NOT NULL DEFAULT 'exponential',
  max_retries INTEGER NOT NULL DEFAULT 3,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_pipeline_orchestrator_configs(id),
  agent_id UUID NOT NULL,
  pipeline_name TEXT NOT NULL,
  description TEXT,
  stage_count INTEGER NOT NULL DEFAULT 0,
  current_stage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_pipelines(id),
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  stage_type TEXT NOT NULL DEFAULT 'transform',
  input_config JSONB NOT NULL DEFAULT '{}',
  output_config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipelines_agent ON agent_pipelines(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON agent_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON agent_pipeline_stages(pipeline_id);
