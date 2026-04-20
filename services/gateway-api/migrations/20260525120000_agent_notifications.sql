-- Batch 52: Agent Notifications & Alerts
-- Real-time notification system for agents — alerts, digests,
-- preferences, channels, and escalation rules.

CREATE TABLE IF NOT EXISTS agent_notifications (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info',
  channel          TEXT NOT NULL DEFAULT 'in_app',
  title            TEXT NOT NULL,
  body             TEXT,
  priority         TEXT NOT NULL DEFAULT 'normal',
  status           TEXT NOT NULL DEFAULT 'pending',
  source_type      TEXT,
  source_id        TEXT,
  action_url       TEXT,
  metadata         JSONB DEFAULT '{}',
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel          TEXT NOT NULL DEFAULT 'in_app',
  enabled          BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TEXT,
  quiet_hours_end  TEXT,
  frequency        TEXT NOT NULL DEFAULT 'immediate',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, notification_type, channel)
);

CREATE TABLE IF NOT EXISTS notification_channels (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  channel_type     TEXT NOT NULL,
  config           JSONB DEFAULT '{}',
  enabled          BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  notification_type TEXT NOT NULL,
  channel          TEXT NOT NULL DEFAULT 'in_app',
  subject_template TEXT,
  body_template    TEXT NOT NULL,
  variables        JSONB DEFAULT '[]',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalation_rules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  condition_expr   TEXT NOT NULL,
  escalate_after_minutes INTEGER NOT NULL DEFAULT 30,
  escalate_to      TEXT NOT NULL,
  escalation_channel TEXT NOT NULL DEFAULT 'in_app',
  max_escalations  INTEGER NOT NULL DEFAULT 3,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_notifications
CREATE INDEX IF NOT EXISTS idx_notifications_agent ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON agent_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON agent_notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON agent_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON agent_notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON agent_notifications(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON agent_notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON agent_notifications(created_at);

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notif_prefs_agent ON notification_preferences(agent_id);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_type ON notification_preferences(notification_type);

-- Indexes for notification_channels
CREATE INDEX IF NOT EXISTS idx_notif_channels_type ON notification_channels(channel_type);

-- Indexes for notification_templates
CREATE INDEX IF NOT EXISTS idx_notif_templates_type ON notification_templates(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_templates_channel ON notification_templates(channel);

-- Indexes for escalation_rules
CREATE INDEX IF NOT EXISTS idx_escalation_type ON escalation_rules(notification_type);
CREATE INDEX IF NOT EXISTS idx_escalation_enabled ON escalation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_escalation_target ON escalation_rules(escalate_to);
