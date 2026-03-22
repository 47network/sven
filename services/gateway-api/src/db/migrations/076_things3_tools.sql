-- Migration 076: Things 3 tools (macOS hosts)

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
    'tool_things3_list',
    'things3.list',
    'Things3 List',
    'List to-dos from Things 3 (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "list":{"type":"string","default":"Inbox"},
        "include_completed":{"type":"boolean","default":false},
        "limit":{"type":"integer","minimum":1,"maximum":200,"default":50}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "list":{"type":"string"},
        "todos":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['tasks.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_things3_create',
    'things3.create',
    'Things3 Create',
    'Create a to-do in Things 3 (macOS only).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "title":{"type":"string"},
        "notes":{"type":"string"},
        "list":{"type":"string","default":"Inbox"}
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
    ARRAY['tasks.write']::text[],
    '{"timeout_ms":20000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_things3_complete',
    'things3.complete',
    'Things3 Complete',
    'Mark a Things 3 to-do as completed (macOS only).',
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
    ARRAY['tasks.write']::text[],
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

