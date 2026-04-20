-- Batch 414: Telemetry Collector
CREATE TABLE IF NOT EXISTS agent_telemetry_collector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  collection_interval_seconds INT DEFAULT 60,
  retention_days INT DEFAULT 30,
  enabled_metrics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_telemetry_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_telemetry_collector_configs(id),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('counter','gauge','histogram','summary')),
  value DOUBLE PRECISION NOT NULL,
  labels JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_telemetry_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_telemetry_collector_configs(id),
  name TEXT NOT NULL,
  panels JSONB DEFAULT '[]',
  refresh_seconds INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_telemetry_configs_agent ON agent_telemetry_collector_configs(agent_id);
CREATE INDEX idx_telemetry_metrics_config ON agent_telemetry_metrics(config_id);
CREATE INDEX idx_telemetry_metrics_name ON agent_telemetry_metrics(metric_name);
CREATE INDEX idx_telemetry_metrics_recorded ON agent_telemetry_metrics(recorded_at);
