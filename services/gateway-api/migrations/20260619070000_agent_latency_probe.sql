-- Batch 270: Latency Probe
CREATE TABLE IF NOT EXISTS agent_latency_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  probe_name VARCHAR(255) NOT NULL,
  target_host VARCHAR(255) NOT NULL,
  probe_type VARCHAR(50) DEFAULT 'icmp',
  interval_sec INTEGER DEFAULT 10,
  timeout_ms INTEGER DEFAULT 3000,
  packet_count INTEGER DEFAULT 5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_latency_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_latency_configs(id),
  min_ms NUMERIC(10,3),
  max_ms NUMERIC(10,3),
  avg_ms NUMERIC(10,3),
  stddev_ms NUMERIC(10,3),
  packets_sent INTEGER DEFAULT 0,
  packets_received INTEGER DEFAULT 0,
  probed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_latency_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_latency_configs(id),
  baseline_avg_ms NUMERIC(10,3),
  baseline_p95_ms NUMERIC(10,3),
  baseline_p99_ms NUMERIC(10,3),
  sample_count INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_latency_configs_agent ON agent_latency_configs(agent_id);
CREATE INDEX idx_latency_results_config ON agent_latency_results(config_id);
CREATE INDEX idx_latency_baselines_config ON agent_latency_baselines(config_id);
