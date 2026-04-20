CREATE TABLE IF NOT EXISTS agent_metric_aggregator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  aggregation_interval TEXT NOT NULL DEFAULT '1m',
  retention_days INTEGER NOT NULL DEFAULT 90,
  flush_threshold INTEGER NOT NULL DEFAULT 1000,
  dimensions JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metric_aggregator_configs(id),
  agent_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'gauge',
  value NUMERIC NOT NULL,
  unit TEXT,
  dimensions JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_metric_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metric_aggregator_configs(id),
  metric_name TEXT NOT NULL,
  period TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  avg_value NUMERIC,
  sum_value NUMERIC,
  count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON agent_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_rollups_name ON agent_metric_rollups(metric_name);
