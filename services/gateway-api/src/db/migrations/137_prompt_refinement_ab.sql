-- Migration 137: Prompt refinement A/B framework (D6.4)

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.promptRefinement.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.promptRefinement.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'ai.promptRefinement.defaultMetric', '"quality_score"'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'ai.promptRefinement.defaultMetric'
);

CREATE TABLE IF NOT EXISTS ai_prompt_experiments (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  metric_name     TEXT NOT NULL DEFAULT 'quality_score',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  base_prompt     TEXT NOT NULL DEFAULT '',
  variant_a_prompt TEXT NOT NULL DEFAULT '',
  variant_b_prompt TEXT NOT NULL DEFAULT '',
  target_sample_size INTEGER NOT NULL DEFAULT 100,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_experiments_org_status
  ON ai_prompt_experiments (organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_prompt_experiment_runs (
  id              TEXT PRIMARY KEY,
  experiment_id   TEXT NOT NULL REFERENCES ai_prompt_experiments(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  chat_id         TEXT,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  variant         TEXT NOT NULL CHECK (variant IN ('a', 'b')),
  prompt_hash     TEXT NOT NULL DEFAULT '',
  response_message_id TEXT,
  quality_score   NUMERIC(6, 3),
  latency_ms      INTEGER,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_experiment_runs_exp_created
  ON ai_prompt_experiment_runs (experiment_id, created_at DESC);
