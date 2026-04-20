-- Batch 288: Metric Exporter
CREATE TABLE IF NOT EXISTS agent_metric_exp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  export_format TEXT NOT NULL DEFAULT 'prometheus',
  scrape_interval_seconds INTEGER DEFAULT 15,
  retention_days INTEGER DEFAULT 30,
  endpoints JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_metric_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metric_exp_configs(id),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'gauge',
  labels JSONB DEFAULT '{}',
  value DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_metric_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_metric_exp_configs(id),
  metric_name TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_metric_exp_configs_agent ON agent_metric_exp_configs(agent_id);
CREATE INDEX idx_metric_series_config ON agent_metric_series(config_id);
CREATE INDEX idx_metric_alerts_config ON agent_metric_alerts(config_id);
