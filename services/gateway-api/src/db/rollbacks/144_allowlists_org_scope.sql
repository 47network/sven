BEGIN;

DROP INDEX IF EXISTS idx_allowlists_org_created_at;
DROP INDEX IF EXISTS idx_allowlists_org_type_enabled;

ALTER TABLE allowlists
  DROP COLUMN IF EXISTS organization_id;

COMMIT;
