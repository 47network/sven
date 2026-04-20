-- Batch 413: Alert Router
CREATE TABLE IF NOT EXISTS agent_alert_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_channel TEXT NOT NULL DEFAULT 'email',
  escalation_policy JSONB DEFAULT '{}',
  suppression_rules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_alert_router_configs(id),
  name TEXT NOT NULL,
  condition JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  channels TEXT[] NOT NULL DEFAULT '{}',
  cooldown_seconds INT DEFAULT 300,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_alert_rules(id),
  severity TEXT NOT NULL,
  channel TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alert_router_configs_agent ON agent_alert_router_configs(agent_id);
CREATE INDEX idx_alert_rules_config ON agent_alert_rules(config_id);
CREATE INDEX idx_alert_history_rule ON agent_alert_history(rule_id);
CREATE INDEX idx_alert_history_created ON agent_alert_history(created_at);
