-- Migration 107: Logging redaction settings

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'logging.redactSensitive', 'true'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'logging.redactSensitive'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'logging.redactPatterns', '[]'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'logging.redactPatterns'
);
