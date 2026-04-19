-- Invite-based user registration tokens
-- Allows admins to create time-limited invite links for new user onboarding.
CREATE TABLE IF NOT EXISTS invite_tokens (
  id            TEXT PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,
  created_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'user')),
  max_uses      INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1 AND max_uses <= 1000),
  use_count     INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens (token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_org ON invite_tokens (organization_id);

-- Track which users were created via which invite
CREATE TABLE IF NOT EXISTS invite_redemptions (
  id            TEXT PRIMARY KEY,
  invite_id     TEXT NOT NULL REFERENCES invite_tokens(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invite_id, user_id)
);
