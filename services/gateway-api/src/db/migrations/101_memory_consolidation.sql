-- Migration 101: Memory consolidation metadata + settings

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into TEXT REFERENCES memories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memories_archived_at
  ON memories (archived_at);

CREATE INDEX IF NOT EXISTS idx_memories_merged_into
  ON memories (merged_into);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'memory.consolidation.enabled', 'true'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'memory.consolidation.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'memory.consolidation.threshold', '0.9'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'memory.consolidation.threshold'
);
