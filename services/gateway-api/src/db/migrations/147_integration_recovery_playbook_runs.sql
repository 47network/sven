-- Migration 147: Integration recovery playbook run history

CREATE TABLE IF NOT EXISTS integration_recovery_playbook_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT,
  requested_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_recovery_playbook_runs_org_created
  ON integration_recovery_playbook_runs (organization_id, created_at DESC);
