-- Migration 098: Discovery settings

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('discovery.enabled', 'true'::jsonb, NOW(), 'migration-098')
ON CONFLICT (key) DO NOTHING;
