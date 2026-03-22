BEGIN;

ALTER TABLE allowlists
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_allowlists_org_type_enabled
  ON allowlists (organization_id, type, enabled);

CREATE INDEX IF NOT EXISTS idx_allowlists_org_created_at
  ON allowlists (organization_id, created_at DESC);

COMMIT;
