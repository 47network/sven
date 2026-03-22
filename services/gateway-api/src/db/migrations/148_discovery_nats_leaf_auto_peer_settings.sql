-- Migration 148: Discovery NATS leaf auto-peer settings

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('discovery.natsLeafAutoPeer.enabled', 'false'::jsonb, NOW(), 'migration-148'),
  ('discovery.natsLeafAutoPeer.peers', '[]'::jsonb, NOW(), 'migration-148')
ON CONFLICT (key) DO NOTHING;
