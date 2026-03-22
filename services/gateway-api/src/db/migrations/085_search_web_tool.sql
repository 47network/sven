-- Migration 085: SearXNG search.web tool registration + defaults

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
  'tool_search_web',
  'search.web',
  'Web Search (SearXNG)',
  'Query self-hosted SearXNG and return structured, sanitized web results.',
  'in_process',
  '{
    "type":"object",
    "properties":{
      "query":{"type":"string"},
      "num_results":{"type":"integer","minimum":1,"maximum":50,"default":10},
      "categories":{"type":"string","description":"Comma-separated categories: general,images,news,files,science"},
      "language":{"type":"string","default":"auto"}
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
  ARRAY['search.web']::text[],
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

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('search.safeSearch', '"moderate"'::jsonb, NOW(), 'migration:085_search_web_tool'),
  ('search.engines', '["google","bing","duckduckgo","wikipedia"]'::jsonb, NOW(), 'migration:085_search_web_tool'),
  ('search.default_language', '"auto"'::jsonb, NOW(), 'migration:085_search_web_tool'),
  ('search.max_results', '10'::jsonb, NOW(), 'migration:085_search_web_tool'),
  ('search.searxng_url', '"http://searxng:8080"'::jsonb, NOW(), 'migration:085_search_web_tool')
ON CONFLICT (key) DO NOTHING;
