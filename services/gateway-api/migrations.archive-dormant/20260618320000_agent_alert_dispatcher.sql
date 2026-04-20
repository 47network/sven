-- Agent Alert Dispatcher tables
CREATE TABLE IF NOT EXISTS agent_alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('email','slack','webhook','pagerduty','discord','sms','teams')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','rate_limited','error','testing')),
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  condition JSONB NOT NULL,
  channels UUID[] NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','muted','testing','expired')),
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_alert_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_alert_rules(id),
  status VARCHAR(50) NOT NULL DEFAULT 'firing' CHECK (status IN ('firing','acknowledged','resolved','escalated','suppressed')),
  severity VARCHAR(20) NOT NULL,
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_agent_alert_channels_agent ON agent_alert_channels(agent_id);
CREATE INDEX idx_agent_alert_rules_agent ON agent_alert_rules(agent_id);
CREATE INDEX idx_agent_alert_incidents_rule ON agent_alert_incidents(rule_id);
CREATE INDEX idx_agent_alert_incidents_status ON agent_alert_incidents(status);
