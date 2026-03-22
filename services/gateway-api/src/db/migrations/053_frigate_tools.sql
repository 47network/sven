-- Frigate integration settings and first-party tools

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('frigate.base_url', '""', NOW(), 'migration:053_frigate_tools'),
  ('frigate.token_ref', '""', NOW(), 'migration:053_frigate_tools')
ON CONFLICT (key) DO NOTHING;

INSERT INTO tools (
  id,
  name,
  display_name,
  category,
  trust_level,
  execution_mode,
  permissions_required,
  inputs_schema,
  outputs_schema,
  timeout_ms,
  max_concurrency,
  enabled,
  created_at
)
VALUES (
  gen_random_uuid()::text,
  'frigate.list_events',
  'Frigate List Events',
  'vision',
  'trusted',
  'in_process',
  ARRAY['frigate.read']::text[],
  '{
    "type":"object",
    "properties":{
      "camera":{"type":"string"},
      "label":{"type":"string"},
      "zone":{"type":"string"},
      "limit":{"type":"integer","minimum":1,"maximum":500},
      "has_clip":{"type":"integer","enum":[0,1]},
      "has_snapshot":{"type":"integer","enum":[0,1]}
    },
    "additionalProperties":false
  }'::jsonb,
  '{
    "type":"object",
    "properties":{"events":{"type":"array"}},
    "required":["events"]
  }'::jsonb,
  15000,
  4,
  TRUE,
  NOW()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id,
  name,
  display_name,
  category,
  trust_level,
  execution_mode,
  permissions_required,
  inputs_schema,
  outputs_schema,
  timeout_ms,
  max_concurrency,
  enabled,
  created_at
)
VALUES (
  gen_random_uuid()::text,
  'frigate.get_event',
  'Frigate Get Event',
  'vision',
  'trusted',
  'in_process',
  ARRAY['frigate.read']::text[],
  '{
    "type":"object",
    "properties":{"event_id":{"type":"string","minLength":1}},
    "required":["event_id"],
    "additionalProperties":false
  }'::jsonb,
  '{
    "type":"object",
    "properties":{"event":{"type":"object"}},
    "required":["event"]
  }'::jsonb,
  15000,
  4,
  TRUE,
  NOW()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id,
  name,
  display_name,
  category,
  trust_level,
  execution_mode,
  permissions_required,
  inputs_schema,
  outputs_schema,
  timeout_ms,
  max_concurrency,
  enabled,
  created_at
)
VALUES (
  gen_random_uuid()::text,
  'frigate.list_cameras',
  'Frigate List Cameras',
  'vision',
  'trusted',
  'in_process',
  ARRAY['frigate.read']::text[],
  '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  '{
    "type":"object",
    "properties":{"cameras":{"type":"object"}},
    "required":["cameras"]
  }'::jsonb,
  15000,
  4,
  TRUE,
  NOW()
)
ON CONFLICT (name) DO NOTHING;
