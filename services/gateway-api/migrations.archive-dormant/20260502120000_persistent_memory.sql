-- Batch 28: Persistent Memory — Cross-Session Memory, Compression, Retrieval
-- Gives Sven true persistent memory with hierarchical summarization and semantic search.

-- ── Memory tiers ──────────────────────────────────────────────────────────
-- Three-tier hierarchy: working → episodic → semantic.
-- Working: raw recent memories (full detail, ~7 days).
-- Episodic: compressed summaries of related working memories (~90 days).
-- Semantic: distilled core facts, preferences, decisions (permanent).

CREATE TABLE IF NOT EXISTS memory_tiers (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    user_id         TEXT,
    tier            TEXT NOT NULL CHECK (tier IN ('working', 'episodic', 'semantic')),
    category        TEXT NOT NULL CHECK (category IN (
                      'preference', 'decision', 'pattern', 'constraint',
                      'architecture', 'correction', 'convention', 'fact',
                      'relationship', 'project_state', 'learning'
                    )),
    content         TEXT NOT NULL,
    summary         TEXT,
    keywords        TEXT[] DEFAULT '{}',
    confidence      NUMERIC(4,3) NOT NULL DEFAULT 1.000
                      CHECK (confidence >= 0 AND confidence <= 1),
    decay           NUMERIC(4,3) NOT NULL DEFAULT 1.000
                      CHECK (decay >= 0 AND decay <= 1),
    reinforcement_count INT NOT NULL DEFAULT 1,
    source_session_id   TEXT,
    source_message_idx  INT,
    parent_memory_id    TEXT REFERENCES memory_tiers(id) ON DELETE SET NULL,
    compressed_from     TEXT[] DEFAULT '{}',
    token_count         INT NOT NULL DEFAULT 0,
    last_accessed_at    TIMESTAMPTZ,
    last_reinforced_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_tiers_org
    ON memory_tiers(org_id);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_user
    ON memory_tiers(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_tier
    ON memory_tiers(org_id, tier);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_category
    ON memory_tiers(org_id, category);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_keywords
    ON memory_tiers USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_confidence
    ON memory_tiers(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memory_tiers_decay
    ON memory_tiers(decay);

-- ── Compression jobs ──────────────────────────────────────────────────────
-- Track hierarchical compression runs (working→episodic, episodic→semantic).

CREATE TABLE IF NOT EXISTS memory_compression_jobs (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    source_tier     TEXT NOT NULL CHECK (source_tier IN ('working', 'episodic')),
    target_tier     TEXT NOT NULL CHECK (target_tier IN ('episodic', 'semantic')),
    status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    source_count    INT NOT NULL DEFAULT 0,
    output_count    INT NOT NULL DEFAULT 0,
    tokens_saved    INT NOT NULL DEFAULT 0,
    compression_ratio NUMERIC(5,2) DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compression_jobs_org
    ON memory_compression_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_compression_jobs_status
    ON memory_compression_jobs(status);

-- ── Memory retrieval log ──────────────────────────────────────────────────
-- Track which memories are retrieved and how useful they are.

CREATE TABLE IF NOT EXISTS memory_retrieval_log (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    query           TEXT NOT NULL,
    retrieved_ids   TEXT[] NOT NULL DEFAULT '{}',
    retrieval_method TEXT NOT NULL CHECK (retrieval_method IN (
                      'keyword', 'semantic', 'recency', 'hybrid'
                    )),
    relevance_scores NUMERIC[] DEFAULT '{}',
    tokens_injected INT NOT NULL DEFAULT 0,
    feedback        TEXT CHECK (feedback IN ('helpful', 'irrelevant', 'partial', NULL)),
    session_id      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_log_org
    ON memory_retrieval_log(org_id);

-- ── Memory config ─────────────────────────────────────────────────────────
-- Per-org memory configuration stored in settings_global.

INSERT INTO settings_global (key, value)
VALUES
    ('memory.tiers.working.ttl_days', '"7"'),
    ('memory.tiers.episodic.ttl_days', '"90"'),
    ('memory.tiers.semantic.ttl_days', '"null"'),
    ('memory.compression.auto_enabled', '"true"'),
    ('memory.compression.threshold_count', '"50"'),
    ('memory.compression.target_ratio', '"0.2"'),
    ('memory.retrieval.default_method', '"hybrid"'),
    ('memory.retrieval.top_k', '"10"'),
    ('memory.retrieval.auto_inject', '"true"'),
    ('memory.decay.half_life_days', '"30"'),
    ('memory.decay.floor', '"0.1"')
ON CONFLICT (key) DO NOTHING;

-- ── Extend marketplace_tasks ──────────────────────────────────────────────

ALTER TABLE marketplace_tasks
    DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;

ALTER TABLE marketplace_tasks
ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'translate', 'write', 'review', 'proofread', 'format',
    'cover_design', 'genre_research', 'design', 'research', 'support',
    'misiuni_post', 'misiuni_verify', 'legal_research', 'print_broker',
    'trend_research', 'author_persona', 'social_post', 'social_analytics',
    'merch_listing', 'product_design',
    'council_deliberate', 'council_vote',
    'memory_remember', 'memory_recall', 'memory_compress'
  ));
