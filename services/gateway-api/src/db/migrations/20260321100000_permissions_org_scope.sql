BEGIN;

ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill from creator's active organization.
UPDATE permissions p
SET organization_id = u.active_organization_id
FROM users u
WHERE p.organization_id IS NULL
  AND p.created_by = u.id
  AND u.active_organization_id IS NOT NULL;

-- Backfill from user-scoped targets when possible.
UPDATE permissions p
SET organization_id = om.organization_id
FROM organization_memberships om
WHERE p.organization_id IS NULL
  AND p.target_type = 'user'
  AND p.target_id = om.user_id
  AND om.status = 'active';

-- Backfill from chat-scoped targets when possible.
UPDATE permissions p
SET organization_id = c.organization_id
FROM chats c
WHERE p.organization_id IS NULL
  AND p.target_type = 'chat'
  AND p.target_id = c.id;

-- Last-resort backfill: pick first active membership for creator.
UPDATE permissions p
SET organization_id = fallback.organization_id
FROM (
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    m.organization_id
  FROM organization_memberships m
  WHERE m.status = 'active'
  ORDER BY m.user_id, m.created_at, m.organization_id
) AS fallback
WHERE p.organization_id IS NULL
  AND p.created_by = fallback.user_id;

CREATE INDEX IF NOT EXISTS idx_permissions_org_scope
  ON permissions (organization_id, scope);

CREATE INDEX IF NOT EXISTS idx_permissions_org_target
  ON permissions (organization_id, target_type, target_id);

COMMIT;
