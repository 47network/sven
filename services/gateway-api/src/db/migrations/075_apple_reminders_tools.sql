-- Migration 075: Apple Reminders tools (macOS hosts)

INSERT INTO tools (
  id,
  name,
  display_name,
  description,
  execution_mode,
  inputs_schema,
  outputs_schema,
  permissions_required,
  resource_limits,
  is_first_party,
  trust_level,
  created_at,
  updated_at
)
VALUES
  (
    'tool_apple_reminders_list',
    'apple.reminders.list',
    'Apple Reminders List',
    'List reminders from Apple Reminders (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "list":{"type":"string"},
        "include_completed":{"type":"boolean","default":false},
        "limit":{"type":"integer","minimum":1,"maximum":200,"default":50}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "reminders":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['reminders.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_apple_reminders_create',
    'apple.reminders.create',
    'Apple Reminders Create',
    'Create a reminder in Apple Reminders (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "title":{"type":"string"},
        "list":{"type":"string","default":"Reminders"}
      },
      "required":["title"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "title":{"type":"string"},
        "list":{"type":"string"},
        "created":{"type":"boolean"}
      }
    }'::jsonb,
    ARRAY['reminders.write']::text[],
    '{"timeout_ms":20000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_apple_reminders_complete',
    'apple.reminders.complete',
    'Apple Reminders Complete',
    'Mark a reminder as completed in Apple Reminders (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "title":{"type":"string"}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "completed":{"type":"boolean"}
      }
    }'::jsonb,
    ARRAY['reminders.write']::text[],
    '{"timeout_ms":20000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  )
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  execution_mode = EXCLUDED.execution_mode,
  inputs_schema = EXCLUDED.inputs_schema,
  outputs_schema = EXCLUDED.outputs_schema,
  permissions_required = EXCLUDED.permissions_required,
  resource_limits = EXCLUDED.resource_limits,
  is_first_party = EXCLUDED.is_first_party,
  trust_level = EXCLUDED.trust_level,
  updated_at = NOW();

