-- Batch 65: Agent Feature Flags & Experiments
-- Toggle features, run A/B experiments, gradual rollouts

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id              TEXT PRIMARY KEY,
  flag_key        TEXT NOT NULL UNIQUE,
  flag_name       TEXT NOT NULL,
  description     TEXT,
  flag_type       TEXT NOT NULL CHECK (flag_type IN ('boolean', 'percentage', 'variant', 'schedule', 'allowlist')),
  default_value   JSONB NOT NULL DEFAULT 'false',
  current_value   JSONB NOT NULL DEFAULT 'false',
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  owner           TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_experiments (
  id              TEXT PRIMARY KEY,
  experiment_key  TEXT NOT NULL UNIQUE,
  experiment_name TEXT NOT NULL,
  description     TEXT,
  hypothesis      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')) DEFAULT 'draft',
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  traffic_pct     INTEGER NOT NULL DEFAULT 100 CHECK (traffic_pct BETWEEN 0 AND 100),
  winner_variant  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id              TEXT PRIMARY KEY,
  experiment_id   TEXT NOT NULL REFERENCES agent_experiments(id) ON DELETE CASCADE,
  variant_key     TEXT NOT NULL,
  variant_name    TEXT NOT NULL,
  weight          INTEGER NOT NULL DEFAULT 50 CHECK (weight BETWEEN 0 AND 100),
  config          JSONB NOT NULL DEFAULT '{}',
  is_control      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, variant_key)
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id              TEXT PRIMARY KEY,
  experiment_id   TEXT NOT NULL REFERENCES agent_experiments(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  variant_id      TEXT NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, agent_id)
);

CREATE TABLE IF NOT EXISTS experiment_metrics (
  id              TEXT PRIMARY KEY,
  experiment_id   TEXT NOT NULL REFERENCES agent_experiments(id) ON DELETE CASCADE,
  variant_id      TEXT NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  metric_name     TEXT NOT NULL,
  metric_value    DOUBLE PRECISION NOT NULL,
  sample_size     INTEGER NOT NULL DEFAULT 1,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flags_key ON agent_feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_flags_type ON agent_feature_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_flags_enabled ON agent_feature_flags(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_flags_owner ON agent_feature_flags(owner);
CREATE INDEX IF NOT EXISTS idx_flags_tags ON agent_feature_flags USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_experiments_key ON agent_experiments(experiment_key);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON agent_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_dates ON agent_experiments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_experiment_variants_exp ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_variants_key ON experiment_variants(experiment_id, variant_key);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_exp ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_agent ON experiment_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_variant ON experiment_assignments(variant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_exp ON experiment_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_variant ON experiment_metrics(variant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_name ON experiment_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_recorded ON experiment_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_flags_updated ON agent_feature_flags(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_created ON agent_experiments(created_at DESC);
