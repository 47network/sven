-- Rollback for 130_voice_multilanguage_settings.sql

DELETE FROM settings_global
WHERE key IN (
  'voice.multiLanguage.enabled',
  'voice.multiLanguage.autoDetect',
  'voice.multiLanguage.respondInKind'
);
