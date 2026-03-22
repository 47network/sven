-- Migration 087: Chat message queue for busy-agent buffering

CREATE TABLE IF NOT EXISTS chat_processing_state (
  chat_id TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
  is_processing BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_message_queue (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  dispatched_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_message_queue_chat_status_created
  ON chat_message_queue(chat_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_message_queue_expires
  ON chat_message_queue(status, expires_at);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('chat.messageQueue.enabled', 'true'::jsonb, NOW(), 'migration:087_chat_message_queue'),
  ('chat.messageQueue.maxDepth', '10'::jsonb, NOW(), 'migration:087_chat_message_queue'),
  ('chat.messageQueue.timeoutMinutes', '30'::jsonb, NOW(), 'migration:087_chat_message_queue')
ON CONFLICT (key) DO NOTHING;
