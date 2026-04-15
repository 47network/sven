-- Migration: Memory compression & analytics schema for Epic C (Persistent Memory System)
-- Adds compression_level to memories, creates memory_summaries for compressed
-- session summaries, and memory_analytics for token savings tracking.

-- C.4.1 — compression_level on existing memories table
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS compression_level SMALLINT NOT NULL DEFAULT 0;
-- 0 = raw, 1 = paragraph, 2 = bullets, 3 = tags

COMMENT ON COLUMN memories.compression_level IS 'Progressive summarization level: 0=raw, 1=paragraph, 2=bullets, 3=tags';

CREATE INDEX IF NOT EXISTS idx_memories_compression_level
  ON memories (compression_level, importance DESC);

-- C.4.2 — Compressed session summaries
CREATE TABLE IF NOT EXISTS memory_summaries (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id           TEXT REFERENCES chats(id) ON DELETE SET NULL,
  organization_id   TEXT,
  source_message_count INTEGER NOT NULL DEFAULT 0,
  source_token_count   INTEGER NOT NULL DEFAULT 0,
  summary_text      TEXT NOT NULL,
  summary_tokens    INTEGER NOT NULL DEFAULT 0,
  compression_ratio REAL NOT NULL DEFAULT 1.0,
  compression_level SMALLINT NOT NULL DEFAULT 1,
  importance_score  REAL NOT NULL DEFAULT 1.0,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  embedding         vector(1536),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_user
  ON memory_summaries (user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_chat
  ON memory_summaries (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_embedding
  ON memory_summaries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

COMMENT ON TABLE memory_summaries IS 'Compressed session summaries from progressive summarization pipeline';

-- C.4.3 — Memory usage analytics
CREATE TABLE IF NOT EXISTS memory_analytics (
  id              TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  chat_id         TEXT REFERENCES chats(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  -- event_type: 'retrieval', 'compression', 'dedup', 'eviction', 'budget_allocation'
  tokens_before   INTEGER NOT NULL DEFAULT 0,
  tokens_after    INTEGER NOT NULL DEFAULT 0,
  tokens_saved    INTEGER NOT NULL DEFAULT 0,
  memories_involved INTEGER NOT NULL DEFAULT 0,
  hit_rate        REAL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_analytics_user_event
  ON memory_analytics (user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_analytics_org
  ON memory_analytics (organization_id, event_type, created_at DESC);

COMMENT ON TABLE memory_analytics IS 'Tracks memory system efficiency: token savings, hit rates, compression ratios';
