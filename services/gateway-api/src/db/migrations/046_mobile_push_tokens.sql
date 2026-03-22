-- Migration 046: Mobile push tokens

CREATE TABLE IF NOT EXISTS mobile_push_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform   TEXT NOT NULL,
    token      TEXT NOT NULL,
    device_id  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_push_tokens_user_token
  ON mobile_push_tokens(user_id, token);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user
  ON mobile_push_tokens(user_id);
