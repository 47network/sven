-- Batch 205: ETL Processor
-- Extract-Transform-Load pipeline management

CREATE TABLE IF NOT EXISTS agent_etl_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schedule_cron VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','error','completed','archived')),
  source_config JSONB NOT NULL DEFAULT '{}',
  transform_config JSONB NOT NULL DEFAULT '{}',
  sink_config JSONB NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_etl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_etl_pipelines(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','extracting','transforming','loading','completed','failed','cancelled')),
  records_extracted BIGINT DEFAULT 0,
  records_transformed BIGINT DEFAULT 0,
  records_loaded BIGINT DEFAULT 0,
  records_failed BIGINT DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_etl_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_etl_pipelines(id),
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,
  retry_on_failure BOOLEAN DEFAULT true,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_etl_pipelines_agent ON agent_etl_pipelines(agent_id);
CREATE INDEX idx_etl_pipelines_status ON agent_etl_pipelines(status);
CREATE INDEX idx_etl_runs_pipeline ON agent_etl_runs(pipeline_id);
CREATE INDEX idx_etl_runs_status ON agent_etl_runs(status);
CREATE INDEX idx_etl_schedules_pipeline ON agent_etl_schedules(pipeline_id);
