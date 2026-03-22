CREATE TABLE IF NOT EXISTS wake_word_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_message_id TEXT,
  sender_identity_id TEXT REFERENCES identities(id),
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  audio_url TEXT,
  audio_mime TEXT,
  detection_confidence NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wake_word_chat ON wake_word_events (chat_id, created_at);
