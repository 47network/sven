-- Migration 136: Tool selection optimization (D6.3)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.toolSelectionOptimization.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.toolSelectionOptimization.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.toolSelectionOptimization.minSamples', '5'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.toolSelectionOptimization.minSamples'
);

CREATE TABLE IF NOT EXISTS ai_tool_selection_preferences (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  intent_key      TEXT NOT NULL,
  preferred_tool_name TEXT NOT NULL,
  confidence      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  rationale       TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  updated_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, intent_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_selection_pref_org_updated
  ON ai_tool_selection_preferences (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_tool_selection_recommendations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_key      TEXT NOT NULL,
  candidate_tool_name TEXT NOT NULL,
  confidence      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  observed_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_selection_reco_org_created
  ON ai_tool_selection_recommendations (organization_id, created_at DESC);
