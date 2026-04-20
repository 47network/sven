-- Batch 324: Metrics Hub - Agent metrics collection and aggregation
CREATE TABLE IF NOT EXISTS agent_metrics_hub_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  scrape_interval_seconds INTEGER NOT NULL DEFAULT 30,
  retention_days INTEGER NOT NULL DEFAULT 90,
  aggregation_window VARCHAR(20) NOT NULL DEFAULT '1m',
  export_format VARCHAR(50) NOT NULL DEFAULT 'prometheus',
  labels JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_metric_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metrics_hub_configs(id),
  metric_name VARCHAR(255) NOT NULL,
  metric_type VARCHAR(20) NOT NULL DEFAULT 'gauge',
  unit VARCHAR(50),
  description TEXT,
  current_value DECIMAL(20,6),
  min_value DECIMAL(20,6),
  max_value DECIMAL(20,6),
  sample_count BIGINT NOT NULL DEFAULT 0,
  labels JSONB DEFAULT '{}',
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_metric_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metrics_hub_configs(id),
  rule_name VARCHAR(255) NOT NULL,
  expression TEXT NOT NULL,
  threshold DECIMAL(20,6),
  comparison VARCHAR(10) NOT NULL DEFAULT 'gt',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metrics_hub_configs_agent ON agent_metrics_hub_configs(agent_id);
CREATE INDEX idx_metric_series_config ON agent_metric_series(config_id);
CREATE INDEX idx_metric_rules_config ON agent_metric_rules(config_id);
