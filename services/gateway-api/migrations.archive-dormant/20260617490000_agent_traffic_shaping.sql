-- Batch 112 — Agent Traffic Shaping
-- Traffic rules, bandwidth limits, QoS policies

CREATE TABLE IF NOT EXISTS agent_traffic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'ingress',
  protocol VARCHAR(20) NOT NULL DEFAULT 'tcp',
  source_cidr VARCHAR(50),
  destination_cidr VARCHAR(50),
  port_range VARCHAR(50),
  action VARCHAR(30) NOT NULL DEFAULT 'shape',
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_bandwidth_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_id UUID NOT NULL REFERENCES agent_traffic_rules(id) ON DELETE CASCADE,
  max_bandwidth_mbps INT NOT NULL DEFAULT 100,
  burst_bandwidth_mbps INT NOT NULL DEFAULT 150,
  guaranteed_bandwidth_mbps INT NOT NULL DEFAULT 10,
  current_usage_mbps DOUBLE PRECISION NOT NULL DEFAULT 0,
  throttled_count BIGINT NOT NULL DEFAULT 0,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_qos_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  traffic_class VARCHAR(50) NOT NULL DEFAULT 'best_effort',
  dscp_marking INT NOT NULL DEFAULT 0,
  priority_level INT NOT NULL DEFAULT 5,
  max_latency_ms INT,
  max_jitter_ms INT,
  max_packet_loss_pct DOUBLE PRECISION,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traffic_rules_agent ON agent_traffic_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_traffic_rules_direction ON agent_traffic_rules(direction);
CREATE INDEX IF NOT EXISTS idx_bandwidth_limits_rule ON agent_bandwidth_limits(rule_id);
CREATE INDEX IF NOT EXISTS idx_bandwidth_limits_agent ON agent_bandwidth_limits(agent_id);
CREATE INDEX IF NOT EXISTS idx_qos_policies_agent ON agent_qos_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_qos_policies_class ON agent_qos_policies(traffic_class);
