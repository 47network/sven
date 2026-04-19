CREATE TABLE IF NOT EXISTS agent_throughput_analyzer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  metric_name VARCHAR(500) NOT NULL,
  unit VARCHAR(50) DEFAULT 'requests_per_second',
  window_seconds INTEGER DEFAULT 60,
  baseline_value NUMERIC DEFAULT 0,
  alert_on_drop_percent NUMERIC(5,2) DEFAULT 20,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_throughput_analyzer_configs_agent ON agent_throughput_analyzer_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_throughput_analyzer_configs_enabled ON agent_throughput_analyzer_configs(enabled);
