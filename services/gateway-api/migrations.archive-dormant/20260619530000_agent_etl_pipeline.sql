-- Batch 316: ETL Pipeline vertical
CREATE TABLE IF NOT EXISTS agent_etl_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  framework TEXT NOT NULL DEFAULT 'spark' CHECK (framework IN ('spark','flink','airflow','dagster','dbt')),
  schedule_cron TEXT NOT NULL DEFAULT '0 * * * *',
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_minutes INTEGER NOT NULL DEFAULT 60,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_etl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_etl_configs(id),
  job_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  transform_logic JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','succeeded','failed','cancelled')),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_etl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_etl_jobs(id),
  rows_extracted BIGINT NOT NULL DEFAULT 0,
  rows_transformed BIGINT NOT NULL DEFAULT 0,
  rows_loaded BIGINT NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_etl_configs_agent ON agent_etl_configs(agent_id);
CREATE INDEX idx_etl_jobs_config ON agent_etl_jobs(config_id);
CREATE INDEX idx_etl_runs_job ON agent_etl_runs(job_id);
