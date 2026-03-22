-- Migration 133: Meeting assistant sessions (join, notes, summaries)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'voice.meetingAssistant.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'voice.meetingAssistant.enabled'
);

CREATE TABLE IF NOT EXISTS meeting_assistant_sessions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  chat_id         TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  provider        TEXT NOT NULL DEFAULT 'manual',
  join_target     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  notes           JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_text    TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_assistant_sessions_org_chat_started
  ON meeting_assistant_sessions (organization_id, chat_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_assistant_sessions_user_status
  ON meeting_assistant_sessions (user_id, status, started_at DESC);
