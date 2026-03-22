-- Migration 130: Multi-language voice settings (D5.4)

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('voice.multiLanguage.enabled', 'true'::jsonb, NOW(), 'migration:130_voice_multilanguage_settings'),
  ('voice.multiLanguage.autoDetect', 'true'::jsonb, NOW(), 'migration:130_voice_multilanguage_settings'),
  ('voice.multiLanguage.respondInKind', 'true'::jsonb, NOW(), 'migration:130_voice_multilanguage_settings')
ON CONFLICT (key) DO NOTHING;
