-- Migration 123: Proactive health monitor issue ledger

CREATE TABLE IF NOT EXISTS proactive_health_issues (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id           TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  issue_key         TEXT NOT NULL,
  services          JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity          TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  summary           TEXT NOT NULL,
  occurrences       INTEGER NOT NULL DEFAULT 1,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at  TIMESTAMPTZ,
  report_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_health_unique_daily
  ON proactive_health_issues (user_id, chat_id, issue_key, report_date);

CREATE INDEX IF NOT EXISTS idx_proactive_health_org_user_last
  ON proactive_health_issues (organization_id, user_id, last_detected_at DESC);
