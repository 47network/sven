BEGIN;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
INSERT INTO registry_sources (id, organization_id, name, type, path, enabled, created_at)
SELECT gen_random_uuid()::text, f.org_id, 'local-skills', 'local', '/opt/sven/registry', TRUE, NOW()
FROM fallback_org f
WHERE NOT EXISTS (
  SELECT 1 FROM registry_sources WHERE name = 'local-skills' AND organization_id = f.org_id
);

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE registry_sources s
SET organization_id = COALESCE(s.organization_id, f.org_id),
    path = '/opt/sven/registry',
    enabled = TRUE
FROM fallback_org f
WHERE s.name = 'local-skills';

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE registry_sources s
SET organization_id = COALESCE(s.organization_id, f.org_id),
    path = '/opt/sven/registry'
FROM fallback_org f
WHERE s.name = 'Local Registry';

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
INSERT INTO registry_publishers (id, organization_id, name, trusted, created_at)
SELECT gen_random_uuid()::text, f.org_id, 'Local Publisher', TRUE, NOW()
FROM fallback_org f
WHERE NOT EXISTS (
  SELECT 1 FROM registry_publishers WHERE name = 'Local Publisher' AND organization_id = f.org_id
);

COMMIT;
