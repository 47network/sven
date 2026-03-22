-- Migration 124: Proactive messaging controls
-- - Admin/tenant gate (default false): agent.proactive.enabled
-- - User proactive preferences: per-channel opt-in and quiet hours

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'agent.proactive.enabled', 'false', NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'agent.proactive.enabled'
);

CREATE TABLE IF NOT EXISTS user_proactive_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  quiet_hours_timezone TEXT NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_proactive_preferences_updated_at
  ON user_proactive_preferences(updated_at DESC);
