-- Migration 103: Session transcript memory indexing controls

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS memory_index_consent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS memory_last_indexed_at TIMESTAMPTZ;

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'memory.indexSessions.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'memory.indexSessions.enabled'
);
