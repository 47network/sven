-- Migration 097: Chat model picker setting

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES ('chat.modelPicker.enabled', 'true'::jsonb, NOW(), 'migration-097')
ON CONFLICT (key) DO NOTHING;
