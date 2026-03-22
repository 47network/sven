BEGIN;

-- 1) Backfill rows where creator has exactly one active org membership.
WITH single_membership AS (
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    om.organization_id
  FROM organization_memberships om
  WHERE om.status = 'active'
  ORDER BY om.user_id, om.created_at, om.organization_id
)
UPDATE allowlists a
SET organization_id = sm.organization_id
FROM single_membership sm
WHERE a.organization_id IS NULL
  AND a.created_by = sm.user_id;

-- 2) If the deployment has exactly one org, adopt remaining null rows into it.
WITH org_count AS (
  SELECT COUNT(*) AS total
  FROM organizations
),
only_org AS (
  SELECT id
  FROM organizations
  ORDER BY created_at, id
  LIMIT 1
)
UPDATE allowlists a
SET organization_id = o.id
FROM only_org o
CROSS JOIN org_count c
WHERE a.organization_id IS NULL
  AND c.total = 1;

COMMIT;
