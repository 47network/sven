-- Batch 260: Link Aggregator
CREATE TABLE IF NOT EXISTS agent_lag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  mode VARCHAR(50) DEFAULT 'active-backup',
  hash_policy VARCHAR(50) DEFAULT 'layer3+4',
  min_links INTEGER DEFAULT 1,
  lacp_rate VARCHAR(50) DEFAULT 'fast',
  mii_monitor_ms INTEGER DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_lag_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES agent_lag_groups(id),
  interface_name VARCHAR(255) NOT NULL,
  speed_mbps INTEGER DEFAULT 1000,
  status VARCHAR(50) DEFAULT 'active',
  priority INTEGER DEFAULT 100,
  link_state VARCHAR(50) DEFAULT 'up',
  rx_bytes BIGINT DEFAULT 0,
  tx_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_lag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES agent_lag_groups(id),
  period_start TIMESTAMPTZ NOT NULL,
  total_throughput_mbps INTEGER DEFAULT 0,
  active_links INTEGER DEFAULT 0,
  failover_count INTEGER DEFAULT 0,
  balance_score NUMERIC(5,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lag_groups_agent ON agent_lag_groups(agent_id);
CREATE INDEX idx_lag_members_group ON agent_lag_members(group_id);
CREATE INDEX idx_lag_stats_group ON agent_lag_stats(group_id);
