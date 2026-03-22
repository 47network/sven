-- ═══════════════════════════════════════════════════════════════════════════
-- 065  Chat Shares — public read-only share links
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS chat_shares (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id         TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  share_token     TEXT NOT NULL UNIQUE,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,  -- NULL = never expires
  UNIQUE(chat_id)               -- one active share per chat
);

CREATE INDEX idx_chat_shares_token ON chat_shares(share_token) WHERE is_active = TRUE;
CREATE INDEX idx_chat_shares_chat  ON chat_shares(chat_id);

-- Record the migration
INSERT INTO _migrations (name) VALUES ('065_chat_shares')
ON CONFLICT DO NOTHING;

COMMIT;
