-- Batch 245: Bandwidth Optimizer — traffic shaping + QoS management
CREATE TABLE IF NOT EXISTS agent_bandwidth_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  profile_name VARCHAR(100) NOT NULL,
  max_bandwidth_mbps INTEGER,
  burst_limit_mbps INTEGER,
  priority_level INTEGER DEFAULT 5,
  shaping_algorithm VARCHAR(30) DEFAULT 'token_bucket',
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_bandwidth_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES agent_bandwidth_profiles(id),
  target_type VARCHAR(30) NOT NULL,
  target_id VARCHAR(255),
  allocated_mbps INTEGER NOT NULL,
  used_mbps_avg NUMERIC(10,2) DEFAULT 0,
  peak_mbps NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_bandwidth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES agent_bandwidth_profiles(id),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  ingress_mbps NUMERIC(10,2),
  egress_mbps NUMERIC(10,2),
  packet_loss_pct NUMERIC(5,2),
  jitter_ms NUMERIC(8,2),
  utilization_pct NUMERIC(5,2),
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_bw_profiles_agent ON agent_bandwidth_profiles(agent_id);
CREATE INDEX idx_bw_alloc_profile ON agent_bandwidth_allocations(profile_id);
CREATE INDEX idx_bw_metrics_profile ON agent_bandwidth_metrics(profile_id);
CREATE INDEX idx_bw_metrics_measured ON agent_bandwidth_metrics(measured_at);
