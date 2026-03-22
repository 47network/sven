-- Insert Home Assistant history tool for in-process execution.
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
  'ha.get_history',
  'HA Get History',
  'Get Home Assistant state history for an entity.',
  'in_process',
  ARRAY['ha.read']::text[],
  '{"type":"object","properties":{"entity_id":{"type":"string"},"start":{"type":"string"},"end":{"type":"string"},"max_entries":{"type":"integer","minimum":1,"maximum":200}},"required":["entity_id"],"additionalProperties":false}',
  '{"type":"object","properties":{"entity_id":{"type":"string"},"states":{"type":"array","items":{"type":"object"}}},"required":["entity_id","states"]}',
  true,
  'trusted'
WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = 'ha.get_history');
