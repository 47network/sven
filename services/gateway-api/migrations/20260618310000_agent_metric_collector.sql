-- Agent Metric Collector tables
CREATE TABLE IF NOT EXISTS agent_metric_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('prometheus','statsd','opentelemetry','cloudwatch','custom','graphite')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','error','initializing')),
  scrape_interval_seconds INTEGER NOT NULL DEFAULT 30,
  endpoint TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_metric_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES agent_metric_sources(id),
  metric_name VARCHAR(255) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('counter','gauge','histogram','summary','distribution')),
  labels JSONB DEFAULT '{}',
  value NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_metric_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  alert_name VARCHAR(255) NOT NULL,
  condition TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','firing','resolved','silenced','disabled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_metric_sources_agent ON agent_metric_sources(agent_id);
CREATE INDEX idx_agent_metric_series_source ON agent_metric_series(source_id);
CREATE INDEX idx_agent_metric_series_name ON agent_metric_series(metric_name);
CREATE INDEX idx_agent_metric_alerts_agent ON agent_metric_alerts(agent_id);
