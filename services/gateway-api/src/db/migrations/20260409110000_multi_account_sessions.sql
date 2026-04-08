-- Migration: Multi-account persistent sessions with device binding
-- Allows users to link multiple accounts on a single device and
-- resume sessions protected by biometric or PIN verification.

CREATE TABLE IF NOT EXISTS linked_accounts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    device_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT false,
    pin_hash        TEXT,
    remember_until  TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_device
  ON linked_accounts(device_id, is_active);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_user
  ON linked_accounts(user_id);

-- Extend sessions with optional device binding for persistent sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sessions_device
  ON sessions(device_id) WHERE device_id IS NOT NULL;
