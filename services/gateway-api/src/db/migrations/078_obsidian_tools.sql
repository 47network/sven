-- Migration 078: Obsidian vault tools

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
    'tool_obsidian_list_notes',
    'obsidian.list_notes',
    'Obsidian List Notes',
    'List markdown notes in an Obsidian vault path.',
    'in_process',
    '{
      "type":"object",
      "properties":{"path":{"type":"string"}},
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "path":{"type":"string"},
        "notes":{"type":"array","items":{"type":"string"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_obsidian_read_note',
    'obsidian.read_note',
    'Obsidian Read Note',
    'Read a markdown note from an Obsidian vault.',
    'in_process',
    '{
      "type":"object",
      "properties":{"path":{"type":"string"}},
      "required":["path"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{"path":{"type":"string"},"content":{"type":"string"}}
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":20000,"max_bytes":4194304,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_obsidian_write_note',
    'obsidian.write_note',
    'Obsidian Write Note',
    'Create or update markdown notes in an Obsidian vault.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "path":{"type":"string"},
        "content":{"type":"string"},
        "append":{"type":"boolean","default":false}
      },
      "required":["path","content"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{"path":{"type":"string"},"wrote":{"type":"boolean"},"append":{"type":"boolean"}}
    }'::jsonb,
    ARRAY['notes.write']::text[],
    '{"timeout_ms":20000,"max_bytes":4194304,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_obsidian_search_notes',
    'obsidian.search_notes',
    'Obsidian Search Notes',
    'Search markdown notes in an Obsidian vault by text query.',
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
      "properties":{
        "query":{"type":"string"},
        "results":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":30000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
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

