-- Migration 105: Streaming pacing controls

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'streaming.chunkSize', '64'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'streaming.chunkSize'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'streaming.humanDelay', '0'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'streaming.humanDelay'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'streaming.coalesce', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'streaming.coalesce'
);
