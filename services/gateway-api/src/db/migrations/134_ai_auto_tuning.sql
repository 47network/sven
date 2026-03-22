-- Migration 134: AI auto-tuning settings + recommendation log

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.autoTuning.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.autoTuning.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.autoTuning.latencyTargetMs', '900'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.autoTuning.latencyTargetMs'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.autoTuning.errorRateTargetPct', '5'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.autoTuning.errorRateTargetPct'
);

CREATE TABLE IF NOT EXISTS ai_auto_tuning_recommendations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title           TEXT NOT NULL,
  rationale       TEXT NOT NULL,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_auto_tuning_reco_org_created
  ON ai_auto_tuning_recommendations (organization_id, created_at DESC);
