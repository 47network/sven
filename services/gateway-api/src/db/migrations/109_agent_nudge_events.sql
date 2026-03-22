-- Migration 109: Agent nudge / unstick state and audit events

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS nudge_nonce INT NOT NULL DEFAULT 0;

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS last_nudged_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agent_nudge_events (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL DEFAULT 'resubmit_last_user_message',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_nudge_events_chat_created
  ON agent_nudge_events(chat_id, created_at DESC);
