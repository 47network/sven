-- ---------------------------------------------------------------------------
-- Epic B — Evolution Engine Tables
-- ---------------------------------------------------------------------------
-- Stores evolution runs, candidate nodes (generation tree), and cognition
-- entries for the ASI-Evolve self-improving research loop.
-- ---------------------------------------------------------------------------

-- B.4.1 — evolution_runs: top-level evolution experiment runs
CREATE TABLE IF NOT EXISTS evolution_runs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  user_id       TEXT,
  experiment    JSONB NOT NULL,           -- ExperimentTemplate
  config        JSONB NOT NULL,           -- EvolutionConfig
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','paused','completed','failed','stopped')),
  current_gen   INTEGER NOT NULL DEFAULT 0,
  best_node_id  TEXT,
  best_score    DOUBLE PRECISION NOT NULL DEFAULT '-Infinity',
  total_evals   INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_evolution_runs_org
  ON evolution_runs (org_id);
CREATE INDEX IF NOT EXISTS idx_evolution_runs_status
  ON evolution_runs (status);
CREATE INDEX IF NOT EXISTS idx_evolution_runs_org_status
  ON evolution_runs (org_id, status);
CREATE INDEX IF NOT EXISTS idx_evolution_runs_updated
  ON evolution_runs (updated_at DESC);

-- B.4.2 — evolution_nodes: candidate solutions (generation tree)
CREATE TABLE IF NOT EXISTS evolution_nodes (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES evolution_runs(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES evolution_nodes(id) ON DELETE SET NULL,
  generation    INTEGER NOT NULL,
  code          TEXT NOT NULL,
  score         DOUBLE PRECISION NOT NULL DEFAULT 0,
  metrics       JSONB NOT NULL DEFAULT '{}',
  analysis      TEXT NOT NULL DEFAULT '',
  visits        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolution_nodes_run
  ON evolution_nodes (run_id);
CREATE INDEX IF NOT EXISTS idx_evolution_nodes_run_gen
  ON evolution_nodes (run_id, generation);
CREATE INDEX IF NOT EXISTS idx_evolution_nodes_run_score
  ON evolution_nodes (run_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_nodes_parent
  ON evolution_nodes (parent_id);

-- B.4.3 — evolution_cognition: knowledge store for evolution runs
CREATE TABLE IF NOT EXISTS evolution_cognition (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES evolution_runs(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'seed'
                  CHECK (source IN ('seed','researcher','analyzer','user')),
  relevance     DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  embedding     vector(1536),            -- optional: for semantic retrieval
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolution_cognition_run
  ON evolution_cognition (run_id);
CREATE INDEX IF NOT EXISTS idx_evolution_cognition_run_relevance
  ON evolution_cognition (run_id, relevance DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_cognition_source
  ON evolution_cognition (run_id, source);
