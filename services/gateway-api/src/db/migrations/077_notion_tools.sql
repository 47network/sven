-- Migration 077: Notion tools

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
    'tool_notion_search',
    'notion.search',
    'Notion Search',
    'Search Notion pages via the Notion API.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "limit":{"type":"integer","minimum":1,"maximum":50,"default":10}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "pages":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_notion_create_page',
    'notion.create_page',
    'Notion Create Page',
    'Create a Notion page under a parent page.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "title":{"type":"string"},
        "content":{"type":"string"},
        "parent_page_id":{"type":"string"}
      },
      "required":["title"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "url":{"type":"string"},
        "title":{"type":"string"},
        "created":{"type":"boolean"}
      }
    }'::jsonb,
    ARRAY['notes.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_notion_append_block_text',
    'notion.append_block_text',
    'Notion Append Text Block',
    'Append a paragraph block to an existing Notion page.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "page_id":{"type":"string"},
        "text":{"type":"string"}
      },
      "required":["page_id","text"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "page_id":{"type":"string"},
        "appended":{"type":"boolean"},
        "results_count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['notes.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
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

