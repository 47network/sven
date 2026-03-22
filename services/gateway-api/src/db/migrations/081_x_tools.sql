-- Migration 081: Twitter / X tools

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
    'tool_x_post_tweet',
    'x.post_tweet',
    'X Post Tweet',
    'Post a tweet using X API v2.',
    'in_process',
    '{
      "type":"object",
      "properties":{"text":{"type":"string"}},
      "required":["text"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"data":{"type":"object"}}}'::jsonb,
    ARRAY['social.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_x_search_recent',
    'x.search_recent',
    'X Search Recent',
    'Search recent tweets using X API v2.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "max_results":{"type":"integer","minimum":10,"maximum":100,"default":10}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"query":{"type":"string"},"data":{"type":"object"}}}'::jsonb,
    ARRAY['social.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
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

