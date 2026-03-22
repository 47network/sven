-- Migration 139: Weekly AI operations summary reports (D6.6)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.opsWeeklyReport.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.opsWeeklyReport.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.opsWeeklyReport.defaultWindowDays', '7'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.opsWeeklyReport.defaultWindowDays'
);

CREATE TABLE IF NOT EXISTS ai_ops_weekly_reports (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_days     INTEGER NOT NULL DEFAULT 7,
  report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  summary         JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative       TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_ops_weekly_reports_org_date
  ON ai_ops_weekly_reports (organization_id, report_date DESC, created_at DESC);
