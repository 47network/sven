-- Batch 102: Agent A/B Testing
CREATE TABLE IF NOT EXISTS agent_ab_experiments (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  experiment_name TEXT NOT NULL,
  description TEXT,
  target_metric TEXT NOT NULL,
  traffic_split JSONB NOT NULL DEFAULT '{"control":50,"variant":50}',
  min_sample_size INTEGER NOT NULL DEFAULT 1000,
  confidence_level REAL NOT NULL DEFAULT 0.95,
  status TEXT NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ab_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES agent_ab_experiments(id),
  variant_name TEXT NOT NULL DEFAULT 'control',
  variant_config JSONB NOT NULL DEFAULT '{}',
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0.0,
  custom_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ab_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES agent_ab_experiments(id),
  variant_id TEXT NOT NULL REFERENCES agent_ab_variants(id),
  user_hash TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ab_results (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES agent_ab_experiments(id),
  winning_variant_id TEXT REFERENCES agent_ab_variants(id),
  statistical_significance REAL,
  p_value REAL,
  lift_percentage REAL,
  confidence_interval JSONB,
  recommendation TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_agent ON agent_ab_experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_ab_variants_experiment ON agent_ab_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment ON agent_ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_user ON agent_ab_assignments(user_hash);
CREATE INDEX IF NOT EXISTS idx_ab_results_experiment ON agent_ab_results(experiment_id);
