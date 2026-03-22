CREATE TABLE IF NOT EXISTS identity_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code TEXT,
  verification_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_type, channel_user_id)
);

CREATE INDEX IF NOT EXISTS idx_identity_links_user_id ON identity_links (user_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_verified ON identity_links (verified, channel_type, channel_user_id);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'identity.auto_link_enabled', 'true'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'identity.auto_link_enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'identity.link_verification_ttl_seconds', '600'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'identity.link_verification_ttl_seconds'
);
