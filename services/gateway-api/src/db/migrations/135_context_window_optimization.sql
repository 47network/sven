-- Migration 135: Context window optimization (D6.2)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.contextWindowOptimization.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.contextWindowOptimization.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.contextWindowOptimization.defaultThresholdPct', '80'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.contextWindowOptimization.defaultThresholdPct'
);

CREATE TABLE IF NOT EXISTS user_context_window_preferences (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  threshold_pct  INTEGER NOT NULL CHECK (threshold_pct BETWEEN 50 AND 95),
  strategy       TEXT NOT NULL DEFAULT 'balanced',
  rationale      TEXT,
  updated_by     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_context_window_preferences_org
  ON user_context_window_preferences (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_context_window_recommendations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_hours    INTEGER NOT NULL,
  observed_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_threshold_pct INTEGER NOT NULL CHECK (recommended_threshold_pct BETWEEN 50 AND 95),
  strategy        TEXT NOT NULL DEFAULT 'balanced',
  rationale       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_context_window_reco_org_created
  ON ai_context_window_recommendations (organization_id, created_at DESC);
