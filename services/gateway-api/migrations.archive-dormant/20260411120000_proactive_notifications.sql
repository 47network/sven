-- Migration: Add proactive notification tables
-- Enables Sven to autonomously send notifications via Slack, Discord, WhatsApp, etc.
-- Creates trigger rules, channel endpoints, and notification log tables.
--
-- Rollback: DROP TABLE proactive_notification_log; DROP TABLE proactive_trigger_rules; DROP TABLE proactive_channel_endpoints;

BEGIN;

-- ─── 1. Trigger rules table ────────────────────────────────────────
-- Defines conditions under which Sven should proactively reach out.

CREATE TABLE IF NOT EXISTS proactive_trigger_rules (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'custom',
  enabled              BOOLEAN NOT NULL DEFAULT true,
  min_severity         TEXT NOT NULL DEFAULT 'info',
  cooldown_seconds     INTEGER NOT NULL DEFAULT 300,
  max_per_hour         INTEGER NOT NULL DEFAULT 10,
  condition_expression TEXT NOT NULL DEFAULT '',
  body_template        TEXT NOT NULL DEFAULT '',
  target_channels      JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_fired_at        TIMESTAMPTZ,
  organization_id      TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_trigger_rules_category
  ON proactive_trigger_rules (category);
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_rules_enabled
  ON proactive_trigger_rules (enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_rules_org
  ON proactive_trigger_rules (organization_id) WHERE organization_id IS NOT NULL;

-- ─── 2. Channel endpoints table ────────────────────────────────────
-- Configured delivery targets (Slack channels, Discord channels, etc.)

CREATE TABLE IF NOT EXISTS proactive_channel_endpoints (
  id                TEXT PRIMARY KEY,
  channel           TEXT NOT NULL,
  channel_chat_id   TEXT NOT NULL,
  label             TEXT NOT NULL DEFAULT '',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  min_severity      TEXT NOT NULL DEFAULT 'info',
  organization_id   TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_channel_endpoints_channel
  ON proactive_channel_endpoints (channel);
CREATE INDEX IF NOT EXISTS idx_proactive_channel_endpoints_enabled
  ON proactive_channel_endpoints (enabled) WHERE enabled = true;

-- ─── 3. Notification log table ─────────────────────────────────────
-- Audit log of all proactive notifications sent.

CREATE TABLE IF NOT EXISTS proactive_notification_log (
  id                 TEXT PRIMARY KEY,
  rule_id            TEXT REFERENCES proactive_trigger_rules(id) ON DELETE SET NULL,
  category           TEXT NOT NULL DEFAULT 'custom',
  severity           TEXT NOT NULL DEFAULT 'info',
  channel            TEXT NOT NULL,
  channel_chat_id    TEXT NOT NULL,
  title              TEXT NOT NULL DEFAULT '',
  body               TEXT NOT NULL DEFAULT '',
  event_data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'pending',
  suppression_reason TEXT,
  feedback_action    TEXT,
  feedback_at        TIMESTAMPTZ,
  organization_id    TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proactive_notification_log_created
  ON proactive_notification_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_notification_log_status
  ON proactive_notification_log (status);
CREATE INDEX IF NOT EXISTS idx_proactive_notification_log_category
  ON proactive_notification_log (category);
CREATE INDEX IF NOT EXISTS idx_proactive_notification_log_rule
  ON proactive_notification_log (rule_id) WHERE rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_notification_log_org
  ON proactive_notification_log (organization_id) WHERE organization_id IS NOT NULL;

COMMIT;
