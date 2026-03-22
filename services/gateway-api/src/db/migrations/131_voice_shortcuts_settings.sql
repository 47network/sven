-- Migration 131: Voice shortcuts settings (D5.5)

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('voice.shortcuts.enabled', 'false'::jsonb, NOW(), 'migration:131_voice_shortcuts_settings'),
  ('voice.shortcuts.allowedServices', '["light.turn_off","light.turn_on","switch.turn_off","switch.turn_on"]'::jsonb, NOW(), 'migration:131_voice_shortcuts_settings')
ON CONFLICT (key) DO NOTHING;
