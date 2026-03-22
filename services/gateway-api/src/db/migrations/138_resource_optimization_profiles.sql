-- Migration 138: Resource optimization profile auto-switching (D6.5)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.resourceOptimization.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.resourceOptimization.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.resourceOptimization.defaultTimezone', '"UTC"'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.resourceOptimization.defaultTimezone'
);

CREATE TABLE IF NOT EXISTS ai_resource_profile_rules (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  priority        INTEGER NOT NULL DEFAULT 100,
  rule_type       TEXT NOT NULL CHECK (rule_type IN ('time_window', 'queue_pressure')),
  target_profile_name TEXT NOT NULL,
  start_hour_utc  INTEGER,
  end_hour_utc    INTEGER,
  queue_depth_pct_threshold NUMERIC(6, 2),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_resource_profile_rules_org_enabled_priority
  ON ai_resource_profile_rules (organization_id, enabled, priority ASC, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_resource_profile_switch_events (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  rule_id         TEXT REFERENCES ai_resource_profile_rules(id) ON DELETE SET NULL,
  previous_profile_name TEXT,
  next_profile_name TEXT NOT NULL,
  reason          TEXT NOT NULL,
  observed_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_resource_profile_switch_events_org_created
  ON ai_resource_profile_switch_events (organization_id, created_at DESC);
