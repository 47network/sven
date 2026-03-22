-- Migration 082: 1Password tools (op CLI bridge)

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
    'tool_onepassword_list_items',
    'onepassword.list_items',
    '1Password List Items',
    'List 1Password items via op CLI.',
    'in_process',
    '{
      "type":"object",
      "properties":{"vault":{"type":"string"}},
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"items":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"}}}'::jsonb,
    ARRAY['secrets.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_onepassword_get_item',
    'onepassword.get_item',
    '1Password Get Item',
    'Fetch full 1Password item JSON via op CLI.',
    'in_process',
    '{
      "type":"object",
      "properties":{"item":{"type":"string"},"vault":{"type":"string"}},
      "required":["item"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"item":{"type":"object"}}}'::jsonb,
    ARRAY['secrets.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":1}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_onepassword_read_field',
    'onepassword.read_field',
    '1Password Read Field',
    'Read specific field value from 1Password item via op:// reference.',
    'in_process',
    '{
      "type":"object",
      "properties":{"item":{"type":"string"},"field":{"type":"string"},"vault":{"type":"string"}},
      "required":["item","field"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"item":{"type":"string"},"field":{"type":"string"},"value":{"type":"string"}}}'::jsonb,
    ARRAY['secrets.read']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":1}'::jsonb,
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

