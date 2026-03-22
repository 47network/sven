-- Migration 127: Voice continuous conversation sessions (D5.1)

CREATE TABLE IF NOT EXISTS voice_continuous_sessions (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT,
  chat_id            TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  sender_identity_id TEXT,
  channel            TEXT NOT NULL DEFAULT 'canvas',
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  ended_at           TIMESTAMPTZ,
  ended_reason       TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_cont_sessions_org_chat_user
  ON voice_continuous_sessions (organization_id, chat_id, user_id, channel, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_cont_sessions_active
  ON voice_continuous_sessions (expires_at, ended_at);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('voice.continuousConversation.enabled', 'false'::jsonb, NOW(), 'migration:127_voice_continuous_conversation'),
  ('voice.continuousConversation.ttlSeconds', '180'::jsonb, NOW(), 'migration:127_voice_continuous_conversation')
ON CONFLICT (key) DO NOTHING;
