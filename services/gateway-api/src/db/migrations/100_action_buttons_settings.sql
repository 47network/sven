INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'chat.actionButtons.enabled', 'true', NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'chat.actionButtons.enabled'
);
