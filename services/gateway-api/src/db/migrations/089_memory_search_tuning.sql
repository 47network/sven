-- Migration 089: Memory temporal decay + MMR settings defaults

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('memory.temporalDecay.enabled', 'true', NOW(), 'system'),
  ('memory.temporalDecay.factor', '0.98', NOW(), 'system'),
  ('memory.mmr.enabled', 'true', NOW(), 'system'),
  ('memory.mmr.lambda', '0.7', NOW(), 'system')
ON CONFLICT (key) DO NOTHING;
