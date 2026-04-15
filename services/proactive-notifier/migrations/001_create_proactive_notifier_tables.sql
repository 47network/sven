-- Migration: 001_create_proactive_notifier_tables.sql
-- Service:   @sven/proactive-notifier-service
-- Created:   2026-04-15
-- Purpose:   Postgres schema for proactive notification engine

BEGIN;

-- ── Trigger Rules ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proactive_trigger_rules (
  id                   UUID PRIMARY KEY,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL CHECK (category IN (
    'critical_error', 'resource_exhaustion', 'security_alert',
    'training_milestone', 'health_degraded', 'task_completed',
    'scheduled_digest', 'custom'
  )),
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  min_severity         TEXT NOT NULL DEFAULT 'warning' CHECK (min_severity IN ('info', 'warning', 'error', 'critical')),
  cooldown_seconds     INTEGER NOT NULL DEFAULT 300,
  max_per_hour         INTEGER NOT NULL DEFAULT 10,
  condition_expression TEXT NOT NULL DEFAULT 'true',
  body_template        TEXT NOT NULL,
  target_channels      TEXT[] NOT NULL DEFAULT '{}',
  last_fired_at        TIMESTAMPTZ,
  organization_id      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_rules_category ON proactive_trigger_rules (category, enabled);
CREATE INDEX IF NOT EXISTS idx_proactive_rules_org ON proactive_trigger_rules (organization_id) WHERE organization_id IS NOT NULL;

-- ── Channel Endpoints ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proactive_channel_endpoints (
  id              UUID PRIMARY KEY,
  channel         TEXT NOT NULL CHECK (channel IN ('slack', 'discord', 'whatsapp', 'matrix', 'telegram', 'email', 'push', 'webhook')),
  channel_chat_id TEXT NOT NULL,
  label           TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  min_severity    TEXT NOT NULL DEFAULT 'info' CHECK (min_severity IN ('info', 'warning', 'error', 'critical')),
  organization_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_endpoints_channel ON proactive_channel_endpoints (channel, enabled);
CREATE INDEX IF NOT EXISTS idx_proactive_endpoints_org ON proactive_channel_endpoints (organization_id) WHERE organization_id IS NOT NULL;

-- ── Notification Log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proactive_notification_log (
  id                 UUID PRIMARY KEY,
  rule_id            UUID REFERENCES proactive_trigger_rules(id) ON DELETE SET NULL,
  category           TEXT NOT NULL,
  severity           TEXT NOT NULL,
  channel            TEXT NOT NULL,
  channel_chat_id    TEXT NOT NULL,
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  event_data         JSONB NOT NULL DEFAULT '{}',
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'suppressed')),
  suppression_reason TEXT,
  feedback_action    TEXT CHECK (feedback_action IS NULL OR feedback_action IN ('acknowledged', 'dismissed', 'muted_rule')),
  feedback_at        TIMESTAMPTZ,
  organization_id    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proactive_log_status ON proactive_notification_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_log_rule ON proactive_notification_log (rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_log_org ON proactive_notification_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_log_category ON proactive_notification_log (category, severity, created_at DESC);

COMMIT;
