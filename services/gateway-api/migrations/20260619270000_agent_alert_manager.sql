-- Batch 290: Alert Manager
CREATE TABLE IF NOT EXISTS agent_alert_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_channel TEXT NOT NULL DEFAULT 'nats',
  dedup_interval_minutes INTEGER DEFAULT 5,
  grouping_rules JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_alert_mgr_configs(id),
  rule_name TEXT NOT NULL,
  condition JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  channels JSONB DEFAULT '["nats"]',
  cooldown_minutes INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_alert_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_alert_rules(id),
  state TEXT NOT NULL DEFAULT 'firing',
  message TEXT,
  labels JSONB DEFAULT '{}',
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  acknowledged_by TEXT
);
CREATE INDEX idx_alert_mgr_configs_agent ON agent_alert_mgr_configs(agent_id);
CREATE INDEX idx_alert_rules_config ON agent_alert_rules(config_id);
CREATE INDEX idx_alert_incidents_rule ON agent_alert_incidents(rule_id);
