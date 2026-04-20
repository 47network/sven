-- Batch 132: Agent Notification Router
-- Multi-channel alert routing, escalation policies, notification preferences

CREATE TABLE IF NOT EXISTS agent_notification_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  channel_name    TEXT NOT NULL,
  channel_type    TEXT NOT NULL CHECK (channel_type IN ('email','slack','webhook','sms','discord','telegram','pagerduty')),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  verified        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, channel_name)
);

CREATE TABLE IF NOT EXISTS agent_notification_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  rule_name       TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  channel_id      UUID NOT NULL REFERENCES agent_notification_channels(id),
  filter_pattern  TEXT,
  cooldown_secs   INTEGER DEFAULT 300,
  escalate_after  INTEGER,
  escalate_to     UUID REFERENCES agent_notification_channels(id),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID REFERENCES agent_notification_rules(id),
  channel_id      UUID NOT NULL REFERENCES agent_notification_channels(id),
  severity        TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending','sent','delivered','failed','suppressed')) DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_channels_agent ON agent_notification_channels(agent_id);
CREATE INDEX idx_notification_rules_agent ON agent_notification_rules(agent_id);
CREATE INDEX idx_notification_log_rule ON agent_notification_log(rule_id);
