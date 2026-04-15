-- Council Sessions (LLM Multi-Model Deliberation)
-- Tracks all council deliberation sessions: query, config, opinions, reviews, synthesis

CREATE TABLE IF NOT EXISTS council_sessions (
    id                      TEXT PRIMARY KEY,
    org_id                  TEXT NOT NULL,
    user_id                 TEXT NOT NULL,
    query                   TEXT NOT NULL,
    config                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    synthesis               TEXT,
    opinions                JSONB,
    peer_reviews            JSONB,
    scores                  JSONB,
    total_tokens_prompt     INTEGER NOT NULL DEFAULT 0,
    total_tokens_completion INTEGER NOT NULL DEFAULT 0,
    total_cost              NUMERIC(10,6) NOT NULL DEFAULT 0,
    elapsed_ms              INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_org ON council_sessions (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_sessions_user ON council_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_sessions_status ON council_sessions (status) WHERE status != 'completed';
