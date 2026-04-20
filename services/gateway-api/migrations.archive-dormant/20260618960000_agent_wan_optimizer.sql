-- Batch 259: WAN Optimizer
CREATE TABLE IF NOT EXISTS agent_wan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  optimization_name VARCHAR(255) NOT NULL,
  compression_algo VARCHAR(50) DEFAULT 'lz4',
  dedup_enabled BOOLEAN DEFAULT true,
  tcp_optimization BOOLEAN DEFAULT true,
  bandwidth_limit_mbps INTEGER,
  latency_target_ms INTEGER DEFAULT 50,
  cache_size_mb INTEGER DEFAULT 1024,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_wan_tunnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_wan_configs(id),
  tunnel_name VARCHAR(255) NOT NULL,
  local_endpoint VARCHAR(255) NOT NULL,
  remote_endpoint VARCHAR(255) NOT NULL,
  protocol VARCHAR(50) DEFAULT 'gre',
  encryption VARCHAR(50) DEFAULT 'aes-256',
  status VARCHAR(50) DEFAULT 'active',
  bytes_saved BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_wan_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_wan_configs(id),
  period_start TIMESTAMPTZ NOT NULL,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  bytes_saved BIGINT DEFAULT 0,
  compression_ratio NUMERIC(5,2) DEFAULT 1.0,
  dedup_ratio NUMERIC(5,2) DEFAULT 1.0,
  avg_latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wan_configs_agent ON agent_wan_configs(agent_id);
CREATE INDEX idx_wan_tunnels_config ON agent_wan_tunnels(config_id);
CREATE INDEX idx_wan_metrics_config ON agent_wan_metrics(config_id);
