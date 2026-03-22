-- Insert Home Assistant tools for in-process execution.
INSERT INTO tools (
  id,
  name,
  display_name,
  description,
  execution_mode,
  permissions_required,
  inputs_schema,
  outputs_schema,
  is_first_party,
  trust_level
)
SELECT
  gen_random_uuid()::text,
  'ha.list_entities',
  'HA List Entities',
  'List Home Assistant entities and their current state.',
  'in_process',
  ARRAY['ha.read']::text[],
  '{"type":"object","properties":{},"additionalProperties":false}',
  '{"type":"object","properties":{"entities":{"type":"array","items":{"type":"object","properties":{"entity_id":{"type":"string"},"state":{"type":"string"},"attributes":{"type":"object"}},"required":["entity_id","state"]}}},"required":["entities"]}',
  true,
  'trusted'
WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = 'ha.list_entities');

INSERT INTO tools (
  id,
  name,
  display_name,
  description,
  execution_mode,
  permissions_required,
  inputs_schema,
  outputs_schema,
  is_first_party,
  trust_level
)
SELECT
  gen_random_uuid()::text,
  'ha.get_state',
  'HA Get State',
  'Get the current state for a Home Assistant entity.',
  'in_process',
  ARRAY['ha.read']::text[],
  '{"type":"object","properties":{"entity_id":{"type":"string"}},"required":["entity_id"],"additionalProperties":false}',
  '{"type":"object","properties":{"entity":{"type":"object","properties":{"entity_id":{"type":"string"},"state":{"type":"string"},"attributes":{"type":"object"}},"required":["entity_id","state"]}},"required":["entity"]}',
  true,
  'trusted'
WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = 'ha.get_state');
