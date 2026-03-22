-- Migration 037: Session token usage tracking and compaction defaults

CREATE TABLE IF NOT EXISTS session_token_usage (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    model_name     TEXT,
    input_tokens   INT NOT NULL DEFAULT 0,
    output_tokens  INT NOT NULL DEFAULT 0,
    total_tokens   INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_token_usage_session_created
  ON session_token_usage(session_id, created_at DESC);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('chat.compaction.auto', 'false', NOW(), 'migration-037'),
  ('chat.compaction.threshold_pct', '80', NOW(), 'migration-037'),
  ('chat.model_context_window', '0', NOW(), 'migration-037')
ON CONFLICT (key) DO NOTHING;

