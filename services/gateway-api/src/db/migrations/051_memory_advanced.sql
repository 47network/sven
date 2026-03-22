-- Migration 051: Advanced memory metadata for extraction/consolidation/decay

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS importance REAL NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS access_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_memories_importance
  ON memories (importance DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_last_accessed
  ON memories (last_accessed_at DESC NULLS LAST);
