-- Batch 131: Agent Data Pipeline
-- ETL workflows, data transformations, pipeline orchestration

CREATE TABLE IF NOT EXISTS agent_data_pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  pipeline_name   TEXT NOT NULL,
  pipeline_type   TEXT NOT NULL CHECK (pipeline_type IN ('etl','elt','streaming','batch','cdc')),
  source_type     TEXT NOT NULL CHECK (source_type IN ('postgres','mysql','s3','api','kafka','file','webhook')),
  sink_type       TEXT NOT NULL CHECK (sink_type IN ('postgres','opensearch','s3','api','kafka','warehouse')),
  schedule_cron   TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_status TEXT CHECK (last_run_status IN ('success','failed','running','skipped')),
  last_run_at     TIMESTAMPTZ,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, pipeline_name)
);

CREATE TABLE IF NOT EXISTS agent_pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES agent_data_pipelines(id),
  status          TEXT NOT NULL CHECK (status IN ('queued','running','success','failed','cancelled')),
  records_read    BIGINT DEFAULT 0,
  records_written BIGINT DEFAULT 0,
  records_failed  BIGINT DEFAULT 0,
  bytes_processed BIGINT DEFAULT 0,
  duration_ms     INTEGER,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_pipeline_transforms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES agent_data_pipelines(id),
  transform_name  TEXT NOT NULL,
  transform_type  TEXT NOT NULL CHECK (transform_type IN ('map','filter','aggregate','join','enrich','deduplicate','validate')),
  transform_order INTEGER NOT NULL DEFAULT 0,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_data_pipelines_agent ON agent_data_pipelines(agent_id);
CREATE INDEX idx_pipeline_runs_pipeline ON agent_pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_transforms_pipeline ON agent_pipeline_transforms(pipeline_id);
