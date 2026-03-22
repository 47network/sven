-- Insert Home Assistant service call tool for write actions.
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
  'ha.call_service',
  'HA Call Service',
  'Call a Home Assistant service (domain.service).',
  'in_process',
  ARRAY['ha.write']::text[],
  '{"type":"object","properties":{"service":{"type":"string"},"entity_id":{"type":"string"},"data":{"type":"object"}},"required":["service"],"additionalProperties":false}',
  '{"type":"object","properties":{"result":{"type":"array","items":{"type":"object"}}},"required":["result"]}',
  true,
  'trusted'
WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = 'ha.call_service');
