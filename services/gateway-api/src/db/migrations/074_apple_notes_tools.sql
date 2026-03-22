-- Migration 074: Apple Notes tools (macOS hosts)

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
    'tool_apple_notes_list',
    'apple.notes.list',
    'Apple Notes List',
    'List notes from Apple Notes (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "limit":{"type":"integer","minimum":1,"maximum":100,"default":20},
        "max_body_chars":{"type":"integer","minimum":50,"maximum":4000,"default":500}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "notes":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_apple_notes_create',
    'apple.notes.create',
    'Apple Notes Create',
    'Create a note in Apple Notes (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "title":{"type":"string"},
        "body":{"type":"string"}
      },
      "required":["title","body"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "title":{"type":"string"},
        "created":{"type":"boolean"}
      }
    }'::jsonb,
    ARRAY['notes.write']::text[],
    '{"timeout_ms":20000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_apple_notes_search',
    'apple.notes.search',
    'Apple Notes Search',
    'Search notes in Apple Notes by title/body text (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "limit":{"type":"integer","minimum":1,"maximum":100,"default":20},
        "max_body_chars":{"type":"integer","minimum":50,"maximum":4000,"default":400}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "notes":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
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

