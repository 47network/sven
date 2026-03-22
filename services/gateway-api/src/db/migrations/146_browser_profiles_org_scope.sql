BEGIN;

ALTER TABLE browser_profiles
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'browser_profiles'
      AND constraint_name = 'browser_profiles_name_key'
      AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE browser_profiles DROP CONSTRAINT browser_profiles_name_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_browser_profiles_org_name_unique
  ON browser_profiles (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_browser_profiles_org_created_at
  ON browser_profiles (organization_id, created_at DESC);

COMMIT;
