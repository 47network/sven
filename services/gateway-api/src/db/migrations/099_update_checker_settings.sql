-- Migration 099: Update checker settings defaults

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'system.updateChecker.enabled', 'true'::jsonb, NOW(), 'migration:099_update_checker_settings'
WHERE NOT EXISTS (SELECT 1 FROM settings_global WHERE key = 'system.updateChecker.enabled');

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'system.updateChecker.interval_hours', '24'::jsonb, NOW(), 'migration:099_update_checker_settings'
WHERE NOT EXISTS (SELECT 1 FROM settings_global WHERE key = 'system.updateChecker.interval_hours');
