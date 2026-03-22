-- Migration 086: Dynamic skill authoring tool (skill.author)

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
  'tool_skill_author',
  'skill.author',
  'Skill Author',
  'Generate and register a new SKILL.md package in quarantined mode for admin review.',
  'in_process',
  '{
    "type":"object",
    "properties":{
      "skill_name":{"type":"string"},
      "description":{"type":"string"},
      "handler_language":{"type":"string","enum":["typescript","python","shell"]},
      "handler_code":{"type":"string"},
      "inputs_schema":{"type":"object"},
      "outputs_schema":{"type":"object"},
      "permissions_required":{"type":"array","items":{"type":"string"}},
      "policy_scopes":{"type":"array","items":{"type":"string"}},
      "chat_id":{"type":"string"},
      "user_id":{"type":"string"}
    },
    "required":["skill_name","description","handler_language","inputs_schema","outputs_schema","chat_id","user_id"],
    "additionalProperties":false
  }'::jsonb,
  '{
    "type":"object",
    "properties":{
      "skill_name":{"type":"string"},
      "skill_slug":{"type":"string"},
      "skill_dir":{"type":"string"},
      "tool_name":{"type":"string"},
      "tool_id":{"type":"string"},
      "catalog_entry_id":{"type":"string"},
      "installed_id":{"type":"string"},
      "trust_level":{"type":"string"},
      "review_required":{"type":"boolean"},
      "inherited_scopes":{"type":"array","items":{"type":"string"}}
    }
  }'::jsonb,
  ARRAY[]::text[],
  '{"timeout_ms":45000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
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
  ('agent.dynamicTools.enabled', 'false'::jsonb, NOW(), 'migration:086_dynamic_skill_author_tool'),
  ('agent.dynamicTools.maxCreationsPerHour', '5'::jsonb, NOW(), 'migration:086_dynamic_skill_author_tool')
ON CONFLICT (key) DO NOTHING;
