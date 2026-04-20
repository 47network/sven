CREATE TABLE IF NOT EXISTS agent_latency_profiler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  endpoint_url TEXT NOT NULL,
  percentiles JSONB DEFAULT '[50,90,95,99]',
  sample_rate NUMERIC(5,4) DEFAULT 1.0,
  baseline_p99_ms INTEGER DEFAULT 500,
  alert_threshold_ms INTEGER DEFAULT 1000,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_latency_profiler_configs_agent ON agent_latency_profiler_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_latency_profiler_configs_enabled ON agent_latency_profiler_configs(enabled);
