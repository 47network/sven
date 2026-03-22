-- Rollback for 131_voice_shortcuts_settings.sql

DELETE FROM settings_global
WHERE key IN (
  'voice.shortcuts.enabled',
  'voice.shortcuts.allowedServices'
);
