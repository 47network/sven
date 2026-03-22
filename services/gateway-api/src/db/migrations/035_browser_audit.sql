-- Migration 035: Browser automation audit logs

CREATE TABLE IF NOT EXISTS browser_audit_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    profile_id  TEXT REFERENCES browser_profiles(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('success', 'error', 'denied')),
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_audit_logs_created
  ON browser_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_browser_audit_logs_user
  ON browser_audit_logs(user_id, created_at DESC);
