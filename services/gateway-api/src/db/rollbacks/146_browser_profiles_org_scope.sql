BEGIN;

DROP INDEX IF EXISTS idx_browser_profiles_org_created_at;
DROP INDEX IF EXISTS idx_browser_profiles_org_name_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'browser_profiles'
      AND constraint_name = 'browser_profiles_name_key'
      AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE browser_profiles
      ADD CONSTRAINT browser_profiles_name_key UNIQUE (name);
  END IF;
END $$;

ALTER TABLE browser_profiles
  DROP COLUMN IF EXISTS organization_id;

COMMIT;
