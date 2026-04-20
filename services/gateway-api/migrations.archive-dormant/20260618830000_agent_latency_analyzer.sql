-- Batch 246: Latency Analyzer — network latency measurement + optimization
CREATE TABLE IF NOT EXISTS agent_latency_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_host VARCHAR(255) NOT NULL,
  target_port INTEGER DEFAULT 443,
  protocol VARCHAR(20) DEFAULT 'tcp',
  check_interval_seconds INTEGER DEFAULT 60,
  timeout_ms INTEGER DEFAULT 5000,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_latency_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES agent_latency_targets(id),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  latency_ms NUMERIC(10,2) NOT NULL,
  dns_ms NUMERIC(10,2),
  tcp_ms NUMERIC(10,2),
  tls_ms NUMERIC(10,2),
  ttfb_ms NUMERIC(10,2),
  packet_loss_pct NUMERIC(5,2) DEFAULT 0,
  hop_count INTEGER,
  metadata JSONB DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS agent_latency_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES agent_latency_targets(id),
  baseline_ms NUMERIC(10,2) NOT NULL,
  p50_ms NUMERIC(10,2),
  p95_ms NUMERIC(10,2),
  p99_ms NUMERIC(10,2),
  samples INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_lat_targets_agent ON agent_latency_targets(agent_id);
CREATE INDEX idx_lat_measurements_target ON agent_latency_measurements(target_id);
CREATE INDEX idx_lat_measurements_time ON agent_latency_measurements(measured_at);
CREATE INDEX idx_lat_baselines_target ON agent_latency_baselines(target_id);
