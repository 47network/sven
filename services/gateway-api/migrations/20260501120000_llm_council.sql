-- Batch 27 — LLM Council (Multi-Model Debate)
-- Migration: council_sessions, council_opinions, council_peer_reviews, council_model_metrics

-- 1. council_sessions — top-level deliberation tracking
CREATE TABLE IF NOT EXISTS council_sessions (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  query          TEXT NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','deliberating','synthesizing','completed','failed','cancelled')),
  strategy       TEXT NOT NULL DEFAULT 'weighted'
                   CHECK (strategy IN ('best_of_n','majority_vote','debate','weighted')),
  rounds_total   INT NOT NULL DEFAULT 1,
  rounds_done    INT NOT NULL DEFAULT 0,
  synthesis      TEXT,
  opinions       JSONB DEFAULT '[]',
  peer_reviews   JSONB DEFAULT '[]',
  scores         JSONB DEFAULT '{}',
  winning_model  TEXT,
  total_tokens_prompt     INT NOT NULL DEFAULT 0,
  total_tokens_completion INT NOT NULL DEFAULT 0,
  total_cost     NUMERIC(12,6) NOT NULL DEFAULT 0,
  elapsed_ms     INT NOT NULL DEFAULT 0,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_org       ON council_sessions (org_id);
CREATE INDEX IF NOT EXISTS idx_council_sessions_status    ON council_sessions (status);
CREATE INDEX IF NOT EXISTS idx_council_sessions_created   ON council_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_sessions_user      ON council_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_council_sessions_strategy  ON council_sessions (strategy);

-- 2. council_opinions — individual model responses per session
CREATE TABLE IF NOT EXISTS council_opinions (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  model_alias    TEXT NOT NULL,
  model_name     TEXT NOT NULL,
  round_number   INT NOT NULL DEFAULT 1,
  opinion_text   TEXT NOT NULL,
  confidence     NUMERIC(5,4) DEFAULT 0,
  tokens_prompt  INT NOT NULL DEFAULT 0,
  tokens_completion INT NOT NULL DEFAULT 0,
  cost           NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms     INT NOT NULL DEFAULT 0,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_opinions_session   ON council_opinions (session_id);
CREATE INDEX IF NOT EXISTS idx_council_opinions_model     ON council_opinions (model_alias);
CREATE INDEX IF NOT EXISTS idx_council_opinions_round     ON council_opinions (session_id, round_number);

-- 3. council_peer_reviews — cross-critique between models
CREATE TABLE IF NOT EXISTS council_peer_reviews (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  reviewer_model   TEXT NOT NULL,
  reviewed_model   TEXT NOT NULL,
  round_number     INT NOT NULL DEFAULT 1,
  score            NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (score >= 0 AND score <= 100),
  critique         TEXT NOT NULL,
  strengths        JSONB DEFAULT '[]',
  weaknesses       JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_reviews_session    ON council_peer_reviews (session_id);
CREATE INDEX IF NOT EXISTS idx_council_reviews_reviewer   ON council_peer_reviews (reviewer_model);
CREATE INDEX IF NOT EXISTS idx_council_reviews_reviewed   ON council_peer_reviews (reviewed_model);

-- 4. council_model_metrics — ongoing model quality tracking
CREATE TABLE IF NOT EXISTS council_model_metrics (
  id              TEXT PRIMARY KEY,
  model_alias     TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  sessions_count  INT NOT NULL DEFAULT 0,
  wins_count      INT NOT NULL DEFAULT 0,
  avg_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_latency_ms  INT NOT NULL DEFAULT 0,
  total_tokens    BIGINT NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,6) NOT NULL DEFAULT 0,
  specialties     JSONB DEFAULT '[]',
  last_used_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_metrics_alias     ON council_model_metrics (model_alias);
CREATE INDEX IF NOT EXISTS idx_council_metrics_wins      ON council_model_metrics (wins_count DESC);
CREATE INDEX IF NOT EXISTS idx_council_metrics_score     ON council_model_metrics (avg_score DESC);

-- 5. ALTER marketplace_tasks to include council task types
ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;

ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'translate', 'write', 'review', 'proofread', 'format',
    'cover_design', 'genre_research', 'design', 'research', 'support',
    'misiuni_post', 'misiuni_verify', 'legal_research', 'print_broker',
    'trend_research', 'author_persona', 'social_post', 'social_analytics',
    'merch_listing', 'product_design',
    'council_deliberate', 'council_vote'
  ));
