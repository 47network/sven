-- Migration 110: Delayed memory recall settings

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'memory.delayedRecall.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'memory.delayedRecall.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'memory.delayedRecall.everyNTurns', '3'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'memory.delayedRecall.everyNTurns'
);
