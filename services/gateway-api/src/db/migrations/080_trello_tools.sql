-- Migration 080: Trello tools

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
    'tool_trello_list_boards',
    'trello.list_boards',
    'Trello List Boards',
    'List Trello boards for authenticated user.',
    'in_process',
    '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
    '{"type":"object","properties":{"boards":{"type":"array","items":{"type":"object"}}}}'::jsonb,
    ARRAY['tasks.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_trello_list_cards',
    'trello.list_cards',
    'Trello List Cards',
    'List cards from a Trello list or board.',
    'in_process',
    '{
      "type":"object",
      "properties":{"list_id":{"type":"string"},"board_id":{"type":"string"}},
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"cards":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"}}}'::jsonb,
    ARRAY['tasks.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_trello_create_card',
    'trello.create_card',
    'Trello Create Card',
    'Create a new card in a Trello list.',
    'in_process',
    '{
      "type":"object",
      "properties":{"list_id":{"type":"string"},"name":{"type":"string"},"desc":{"type":"string"}},
      "required":["list_id","name"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"card":{"type":"object"}}}'::jsonb,
    ARRAY['tasks.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_trello_move_card',
    'trello.move_card',
    'Trello Move Card',
    'Move a Trello card to another list.',
    'in_process',
    '{
      "type":"object",
      "properties":{"card_id":{"type":"string"},"list_id":{"type":"string"}},
      "required":["card_id","list_id"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"card":{"type":"object"},"moved":{"type":"boolean"}}}'::jsonb,
    ARRAY['tasks.write']::text[],
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

