-- Migration 079: Bear Notes tools (macOS hosts)

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
    'tool_bear_list_notes',
    'bear.list_notes',
    'Bear List Notes',
    'List notes from Bear (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{"limit":{"type":"integer","minimum":1,"maximum":200,"default":50}},
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{"notes":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"}}
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_bear_create_note',
    'bear.create_note',
    'Bear Create Note',
    'Create a note in Bear (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "title":{"type":"string"},
        "content":{"type":"string"},
        "tags":{"type":"array","items":{"type":"string"}}
      },
      "required":["title"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{"id":{"type":"string"},"title":{"type":"string"},"created":{"type":"boolean"}}
    }'::jsonb,
    ARRAY['notes.write']::text[],
    '{"timeout_ms":20000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_bear_search_notes',
    'bear.search_notes',
    'Bear Search Notes',
    'Search notes in Bear by text query (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "limit":{"type":"integer","minimum":1,"maximum":100,"default":20}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{"query":{"type":"string"},"notes":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"}}
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

