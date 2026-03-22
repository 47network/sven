-- Migration 048: LLM audit log (capture think level + model usage)

BEGIN;

CREATE TABLE IF NOT EXISTS llm_audit_log (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id         TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_name      TEXT NOT NULL,
  think_level     TEXT,
  prompt_tokens   INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_audit_log_chat ON llm_audit_log(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_audit_log_user ON llm_audit_log(user_id, created_at DESC);

COMMIT;
