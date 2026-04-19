-- Batch 272: Packet Loss Tracker
CREATE TABLE IF NOT EXISTS agent_ploss_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  tracker_name VARCHAR(255) NOT NULL,
  target_host VARCHAR(255) NOT NULL,
  probe_interval_sec INTEGER DEFAULT 30,
  burst_count INTEGER DEFAULT 10,
  acceptable_loss_pct NUMERIC(5,2) DEFAULT 1.0,
  alert_consecutive INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_ploss_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_ploss_configs(id),
  packets_sent INTEGER DEFAULT 0,
  packets_received INTEGER DEFAULT 0,
  packets_lost INTEGER DEFAULT 0,
  loss_pct NUMERIC(5,2) DEFAULT 0,
  burst_id VARCHAR(100),
  probed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_ploss_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_ploss_configs(id),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  avg_loss_pct NUMERIC(5,2),
  max_loss_pct NUMERIC(5,2),
  total_probes INTEGER DEFAULT 0,
  degraded_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ploss_configs_agent ON agent_ploss_configs(agent_id);
CREATE INDEX idx_ploss_results_config ON agent_ploss_results(config_id);
CREATE INDEX idx_ploss_trends_config ON agent_ploss_trends(config_id);
