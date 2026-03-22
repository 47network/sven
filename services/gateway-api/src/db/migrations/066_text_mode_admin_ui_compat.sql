BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure org-scoped admin tables have text organization_id in text-id mode.
ALTER TABLE IF EXISTS registry_sources
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS registry_publishers
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS skills_catalog
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS skills_installed
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS skill_signatures
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS skill_quarantine_reports
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS model_registry
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS model_policies
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS model_rollouts
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill org IDs from first organization when missing.
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

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skills_catalog c
SET organization_id = COALESCE(c.organization_id, f.org_id)
FROM fallback_org f
WHERE c.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skills_installed i
SET organization_id = COALESCE(i.organization_id, f.org_id)
FROM fallback_org f
WHERE i.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skill_signatures ss
SET organization_id = COALESCE(ss.organization_id, f.org_id)
FROM fallback_org f
WHERE ss.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE skill_quarantine_reports qr
SET organization_id = COALESCE(qr.organization_id, f.org_id)
FROM fallback_org f
WHERE qr.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_registry mr
SET organization_id = COALESCE(mr.organization_id, f.org_id)
FROM fallback_org f
WHERE mr.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_policies mp
SET organization_id = COALESCE(mp.organization_id, f.org_id)
FROM fallback_org f
WHERE mp.organization_id IS NULL;

WITH fallback_org AS (
  SELECT id AS org_id FROM organizations ORDER BY created_at ASC LIMIT 1
)
UPDATE model_rollouts r
SET organization_id = COALESCE(r.organization_id, f.org_id)
FROM fallback_org f
WHERE r.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_registry_sources_org ON registry_sources (organization_id);
CREATE INDEX IF NOT EXISTS idx_registry_publishers_org ON registry_publishers (organization_id);
CREATE INDEX IF NOT EXISTS idx_skills_catalog_org ON skills_catalog (organization_id);
CREATE INDEX IF NOT EXISTS idx_skills_installed_org ON skills_installed (organization_id);
CREATE INDEX IF NOT EXISTS idx_skill_signatures_org ON skill_signatures (organization_id);
CREATE INDEX IF NOT EXISTS idx_skill_quarantine_org ON skill_quarantine_reports (organization_id);
CREATE INDEX IF NOT EXISTS idx_model_registry_org ON model_registry (organization_id);
CREATE INDEX IF NOT EXISTS idx_model_policies_org ON model_policies (organization_id);
CREATE INDEX IF NOT EXISTS idx_model_rollouts_org ON model_rollouts (organization_id);

-- Create identity aliases with id=user_id so legacy routes that write actor_id=request.userId
-- satisfy foreign keys expecting identities(id).
INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
SELECT
  u.id,
  u.id,
  'internal_user',
  u.id,
  COALESCE(u.display_name, u.username),
  NOW()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM identities i WHERE i.id = u.id
);

-- Add columns expected by workflow execution routes in legacy workflow_runs schema.
ALTER TABLE IF EXISTS workflow_runs
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER,
  ADD COLUMN IF NOT EXISTS triggered_by TEXT REFERENCES identities(id),
  ADD COLUMN IF NOT EXISTS input_variables JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_variables JSONB,
  ADD COLUMN IF NOT EXISTS step_results JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS canvas_event_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10,6) DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workflow_runs'
      AND column_name = 'variables'
  ) THEN
    EXECUTE $q$
      UPDATE workflow_runs
      SET input_variables = COALESCE(input_variables, variables, '{}'::jsonb)
      WHERE input_variables IS NULL
    $q$;
  END IF;
END $$;

ALTER TABLE IF EXISTS workflow_step_runs
  ADD COLUMN IF NOT EXISTS run_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workflow_step_runs'
      AND column_name = 'workflow_run_id'
  ) THEN
    EXECUTE $q$
      UPDATE workflow_step_runs
      SET run_id = COALESCE(run_id, workflow_run_id)
      WHERE run_id IS NULL
    $q$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workflow_runs'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_step_runs_run_id_fkey'
  ) THEN
    ALTER TABLE workflow_step_runs
      ADD CONSTRAINT workflow_step_runs_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_triggered_by ON workflow_runs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(run_id);

-- Legacy settings route inserts without explicit id.
DO $$
DECLARE
  organization_settings_id_type TEXT;
BEGIN
  SELECT data_type INTO organization_settings_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_settings'
    AND column_name = 'id'
  LIMIT 1;

  IF organization_settings_id_type = 'uuid' THEN
    ALTER TABLE organization_settings
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF organization_settings_id_type = 'text' THEN
    ALTER TABLE organization_settings
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
END $$;

-- Registry route expects newer quarantine report columns.
ALTER TABLE IF EXISTS skill_quarantine_reports
  ADD COLUMN IF NOT EXISTS overall_risk TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMIT;
