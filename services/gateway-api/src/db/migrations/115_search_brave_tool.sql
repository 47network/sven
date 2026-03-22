-- Migration 115: Register Brave Search tool (search.brave)

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
VALUES (
  'tool_search_brave',
  'search.brave',
  'Web Search (Brave API)',
  'Query Brave Search API directly and return structured, sanitized web results.',
  'in_process',
  '{
    "type":"object",
    "properties":{
      "query":{"type":"string"},
      "num_results":{"type":"integer","minimum":1,"maximum":20,"default":10},
      "language":{"type":"string","default":"auto"},
      "country":{"type":"string","description":"Optional two-letter country code, e.g. US"}
    },
    "required":["query"],
    "additionalProperties":false
  }'::jsonb,
  '{
    "type":"object",
    "properties":{
      "query":{"type":"string"},
      "total":{"type":"integer"},
      "results":{
        "type":"array",
        "items":{
          "type":"object",
          "properties":{
            "title":{"type":"string"},
            "url":{"type":"string"},
            "snippet":{"type":"string"},
            "source_engine":{"type":"string"}
          },
          "required":["title","url","snippet","source_engine"]
        }
      }
    }
  }'::jsonb,
  ARRAY['search.brave']::text[],
  '{"timeout_ms":15000,"max_bytes":4194304,"max_concurrency":4}'::jsonb,
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
