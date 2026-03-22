BEGIN;

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chats_organization_id ON chats (organization_id, created_at DESC);

-- Backfill existing chats using first member's active org, falling back to any org.
WITH by_member_org AS (
  SELECT DISTINCT ON (c.id)
    c.id AS chat_id,
    u.active_organization_id AS org_id
  FROM chats c
  LEFT JOIN chat_members cm ON cm.chat_id = c.id
  LEFT JOIN users u ON u.id = cm.user_id
  WHERE u.active_organization_id IS NOT NULL
  ORDER BY c.id, cm.joined_at, u.active_organization_id
),
fallback_org AS (
  SELECT id AS org_id
  FROM organizations
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE chats c
SET organization_id = COALESCE(m.org_id, f.org_id)
FROM by_member_org m
CROSS JOIN fallback_org f
WHERE c.id = m.chat_id
  AND c.organization_id IS NULL;

COMMIT;
