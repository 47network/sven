-- Batch 408: ETL Processor
-- Extract-Transform-Load pipeline for agent data processing with source connectors and sink targets

CREATE TABLE IF NOT EXISTS agent_etl_processor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 3,
  batch_size INTEGER NOT NULL DEFAULT 1000,
  error_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_etl_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_etl_processor_configs(id),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('database', 'api', 'file', 'stream', 'webhook')),
  source_config JSONB NOT NULL,
  transform_steps JSONB NOT NULL DEFAULT '[]',
  sink_type TEXT NOT NULL CHECK (sink_type IN ('database', 'api', 'file', 'stream', 'warehouse')),
  sink_config JSONB NOT NULL,
  schedule_cron TEXT,
  last_run_at TIMESTAMPTZ,
  records_processed BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_etl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES agent_etl_pipelines(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'transforming', 'loading', 'completed', 'failed')),
  records_extracted INTEGER NOT NULL DEFAULT 0,
  records_transformed INTEGER NOT NULL DEFAULT 0,
  records_loaded INTEGER NOT NULL DEFAULT 0,
  records_errored INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_etl_pipelines_config ON agent_etl_pipelines(config_id);
CREATE INDEX idx_agent_etl_runs_pipeline ON agent_etl_runs(pipeline_id);
CREATE INDEX idx_agent_etl_runs_status ON agent_etl_runs(status);
