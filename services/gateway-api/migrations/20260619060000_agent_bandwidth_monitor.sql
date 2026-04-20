-- Batch 269: Bandwidth Monitor
CREATE TABLE IF NOT EXISTS agent_bw_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  monitor_name VARCHAR(255) NOT NULL,
  interface_name VARCHAR(255) NOT NULL,
  poll_interval_sec INTEGER DEFAULT 5,
  alert_threshold_mbps NUMERIC(10,2),
  retention_hours INTEGER DEFAULT 168,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_bw_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_bw_configs(id),
  rx_bytes BIGINT DEFAULT 0,
  tx_bytes BIGINT DEFAULT 0,
  rx_rate_mbps NUMERIC(10,2) DEFAULT 0,
  tx_rate_mbps NUMERIC(10,2) DEFAULT 0,
  utilization_pct NUMERIC(5,2) DEFAULT 0,
  sampled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_bw_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_bw_configs(id),
  alert_type VARCHAR(50) NOT NULL,
  threshold_mbps NUMERIC(10,2),
  actual_mbps NUMERIC(10,2),
  direction VARCHAR(10) DEFAULT 'both',
  acknowledged BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bw_configs_agent ON agent_bw_configs(agent_id);
CREATE INDEX idx_bw_samples_config ON agent_bw_samples(config_id);
CREATE INDEX idx_bw_alerts_config ON agent_bw_alerts(config_id);
