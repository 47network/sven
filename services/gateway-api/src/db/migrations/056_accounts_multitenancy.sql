BEGIN;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'operator', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_users_active_org ON users (active_organization_id);

-- Backfill: create one personal org per existing user, then attach membership and set active org.
WITH missing_orgs AS (
  SELECT
    u.id AS user_id,
    ('personal-' || regexp_replace(lower(u.username), '[^a-z0-9]+', '-', 'g')) AS base_slug,
    COALESCE(NULLIF(u.display_name, ''), u.username) AS display_name
  FROM users u
  LEFT JOIN organizations o ON o.owner_user_id = u.id
  WHERE o.id IS NULL
),
ins_orgs AS (
  INSERT INTO organizations (id, slug, name, owner_user_id, created_at, updated_at)
  SELECT
    gen_random_uuid()::text,
    CASE
      WHEN EXISTS (SELECT 1 FROM organizations o2 WHERE o2.slug = m.base_slug) THEN m.base_slug || '-' || substr(md5(m.user_id::text), 1, 6)
      ELSE m.base_slug
    END,
    m.display_name || ' Workspace',
    m.user_id,
    NOW(),
    NOW()
  FROM missing_orgs m
  RETURNING id, owner_user_id
)
INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
SELECT gen_random_uuid()::text, o.id, o.owner_user_id, 'owner', 'active', NOW(), NOW()
FROM ins_orgs o
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Ensure every org owner has a membership row.
INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
SELECT gen_random_uuid()::text, o.id, o.owner_user_id, 'owner', 'active', NOW(), NOW()
FROM organizations o
LEFT JOIN organization_memberships m
  ON m.organization_id = o.id
 AND m.user_id = o.owner_user_id
WHERE m.id IS NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Set default active org where missing.
UPDATE users u
SET active_organization_id = x.organization_id
FROM (
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    m.organization_id
  FROM organization_memberships m
  WHERE m.status = 'active'
  ORDER BY m.user_id, m.created_at, m.organization_id
) x
WHERE u.id = x.user_id
  AND u.active_organization_id IS NULL;

COMMIT;
