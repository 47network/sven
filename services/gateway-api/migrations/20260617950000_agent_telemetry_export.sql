-- Batch 158: Agent Telemetry Export
-- Structured export of metrics, traces, and logs to external observability platforms

CREATE TABLE IF NOT EXISTS agent_telemetry_sinks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  sink_name       TEXT NOT NULL,
  sink_type       TEXT NOT NULL CHECK (sink_type IN ('prometheus','grafana','datadog','otlp','cloudwatch','elasticsearch','custom')),
  endpoint_url    TEXT NOT NULL,
  auth_method     TEXT NOT NULL DEFAULT 'bearer' CHECK (auth_method IN ('bearer','basic','api_key','mtls','none')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','disabled')),
  filter_rules    JSONB NOT NULL DEFAULT '{}',
  batch_size      INT NOT NULL DEFAULT 1000,
  flush_interval  INT NOT NULL DEFAULT 30,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_telemetry_pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sink_id         UUID NOT NULL REFERENCES agent_telemetry_sinks(id),
  pipeline_name   TEXT NOT NULL,
  signal_type     TEXT NOT NULL CHECK (signal_type IN ('metrics','traces','logs','events')),
  transform_rules JSONB NOT NULL DEFAULT '[]',
  sampling_rate   NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_export_at  TIMESTAMPTZ,
  export_count    BIGINT NOT NULL DEFAULT 0,
  error_count     BIGINT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_telemetry_export_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES agent_telemetry_pipelines(id),
  batch_id        TEXT NOT NULL,
  record_count    INT NOT NULL DEFAULT 0,
  byte_size       BIGINT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('pending','exporting','completed','failed','retrying')),
  error_message   TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_sinks_tenant ON agent_telemetry_sinks(tenant_id);
CREATE INDEX idx_telemetry_pipelines_sink ON agent_telemetry_pipelines(sink_id);
CREATE INDEX idx_telemetry_export_log_pipeline ON agent_telemetry_export_log(pipeline_id);
