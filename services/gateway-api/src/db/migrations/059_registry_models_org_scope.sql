BEGIN;

ALTER TABLE registry_sources ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE registry_publishers ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE skills_catalog ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE skills_installed ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE skill_signatures ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE skill_quarantine_reports ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE model_policies ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE model_rollouts ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_registry_sources_org ON registry_sources (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_publishers_org ON registry_publishers (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_catalog_org ON skills_catalog (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_installed_org ON skills_installed (organization_id, installed_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_signatures_org ON skill_signatures (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_quarantine_org ON skill_quarantine_reports (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_registry_org ON model_registry (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_policies_org ON model_policies (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_rollouts_org ON model_rollouts (organization_id, created_at DESC);

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE registry_sources s
SET organization_id = f.org_id
FROM fallback_org f
WHERE s.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE registry_publishers p
SET organization_id = f.org_id
FROM fallback_org f
WHERE p.organization_id IS NULL;

UPDATE skills_catalog c
SET organization_id = COALESCE(c.organization_id, s.organization_id)
FROM registry_sources s
WHERE c.source_id = s.id;

UPDATE skills_installed i
SET organization_id = COALESCE(i.organization_id, c.organization_id)
FROM skills_catalog c
WHERE i.catalog_entry_id = c.id;

UPDATE skill_signatures ss
SET organization_id = COALESCE(ss.organization_id, i.organization_id)
FROM skills_installed i
WHERE ss.skill_id = i.id;

UPDATE skill_quarantine_reports qr
SET organization_id = COALESCE(qr.organization_id, i.organization_id)
FROM skills_installed i
WHERE qr.skill_id = i.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'model_registry'
      AND column_name = 'created_by'
  ) THEN
    UPDATE model_registry mr
    SET organization_id = COALESCE(
      mr.organization_id,
      u.active_organization_id
    )
    FROM users u
    WHERE mr.created_by = u.id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'model_policies'
      AND column_name = 'chat_id'
  ) THEN
    UPDATE model_policies mp
    SET organization_id = COALESCE(mp.organization_id, c.organization_id)
    FROM chats c
    WHERE mp.chat_id = c.id
      AND mp.organization_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'model_policies'
      AND column_name = 'user_id'
  ) THEN
    UPDATE model_policies mp
    SET organization_id = COALESCE(mp.organization_id, u.active_organization_id)
    FROM users u
    WHERE mp.user_id = u.id
      AND mp.organization_id IS NULL;
  END IF;
END $$;

UPDATE model_rollouts r
SET organization_id = COALESCE(r.organization_id, mr.organization_id)
FROM model_registry mr
WHERE r.model_id = mr.id;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skills_catalog c
SET organization_id = f.org_id
FROM fallback_org f
WHERE c.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skills_installed i
SET organization_id = f.org_id
FROM fallback_org f
WHERE i.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skill_signatures ss
SET organization_id = f.org_id
FROM fallback_org f
WHERE ss.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skill_quarantine_reports qr
SET organization_id = f.org_id
FROM fallback_org f
WHERE qr.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_registry mr
SET organization_id = f.org_id
FROM fallback_org f
WHERE mr.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_policies mp
SET organization_id = f.org_id
FROM fallback_org f
WHERE mp.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_rollouts r
SET organization_id = f.org_id
FROM fallback_org f
WHERE r.organization_id IS NULL;

COMMIT;
