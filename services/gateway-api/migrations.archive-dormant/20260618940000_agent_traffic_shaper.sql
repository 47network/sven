-- Batch 257: Traffic Shaper — bandwidth management and QoS
CREATE TABLE IF NOT EXISTS agent_shaper_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  max_bandwidth_mbps INTEGER NOT NULL DEFAULT 100,
  burst_size_kb INTEGER NOT NULL DEFAULT 1024,
  priority_class VARCHAR(50) NOT NULL DEFAULT 'default',
  qos_enabled BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_shaper_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_shaper_policies(id),
  rule_name VARCHAR(255) NOT NULL,
  match_criteria JSONB NOT NULL DEFAULT '{}',
  bandwidth_limit_mbps INTEGER,
  latency_target_ms INTEGER,
  packet_loss_pct NUMERIC(5,2) DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_shaper_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_shaper_policies(id),
  throughput_mbps NUMERIC(10,2),
  packets_shaped BIGINT NOT NULL DEFAULT 0,
  packets_dropped BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  queue_depth INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shaper_policies_agent ON agent_shaper_policies(agent_id);
CREATE INDEX idx_shaper_rules_policy ON agent_shaper_rules(policy_id);
CREATE INDEX idx_shaper_stats_policy ON agent_shaper_stats(policy_id);
