-- Migration 083: GIF search tool (Giphy/Tenor)

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
    'tool_gif_search',
    'gif.search',
    'GIF Search',
    'Search GIFs via Giphy or Tenor.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "engine":{"type":"string","enum":["giphy","tenor"],"default":"giphy"},
        "limit":{"type":"integer","minimum":1,"maximum":25,"default":10}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "engine":{"type":"string"},
        "items":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['media.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
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

