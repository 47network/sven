-- Persist per-user thumbs up/down feedback on chat messages.
-- Compatible with text-based primary keys used by the current deployment mode.

CREATE TABLE IF NOT EXISTS message_feedback (
  id         TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback   TEXT NOT NULL CHECK (feedback IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_chat_user
  ON message_feedback (chat_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_feedback_message
  ON message_feedback (message_id);
