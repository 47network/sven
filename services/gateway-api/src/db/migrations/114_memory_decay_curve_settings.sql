-- Migration 114: Memory temporal decay curve settings defaults

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('memory.temporalDecay.curve', '"exponential"'::jsonb, NOW(), 'system'),
  ('memory.temporalDecay.stepDays', '7'::jsonb, NOW(), 'system')
ON CONFLICT (key) DO NOTHING;
