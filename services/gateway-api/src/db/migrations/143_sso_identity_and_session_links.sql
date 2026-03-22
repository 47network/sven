BEGIN;

CREATE TABLE IF NOT EXISTS sso_identities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('oidc', 'saml')),
  subject TEXT NOT NULL,
  email TEXT,
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_sso_identities_org_user
  ON sso_identities (organization_id, user_id, provider, updated_at DESC);

CREATE TABLE IF NOT EXISTS sso_session_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_kind TEXT NOT NULL CHECK (session_kind IN ('access', 'refresh')),
  provider TEXT NOT NULL CHECK (provider IN ('oidc', 'saml')),
  subject TEXT NOT NULL,
  idp_session_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_sso_session_links_org_user
  ON sso_session_links (organization_id, user_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sso_session_links_org_subject
  ON sso_session_links (organization_id, provider, subject, created_at DESC);

COMMIT;
