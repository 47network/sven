-- ═══════════════════════════════════════════════════════════════════════════
-- 070: API Keys for OpenAI-Compatible Endpoints
-- ═══════════════════════════════════════════════════════════════════════════
-- Allows users to create persistent API keys (sk-sven-xxx) for programmatic
-- access to OpenAI-compatible endpoints (/v1/chat/completions, /v1/models).

BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'default',
  prefix        TEXT NOT NULL,              -- first 8 chars of key for display (sk-sven-xxxx...)
  key_hash      TEXT NOT NULL,              -- bcrypt hash of full key
  scopes        TEXT[] NOT NULL DEFAULT '{openai}',  -- permission scopes
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (prefix);

COMMIT;
