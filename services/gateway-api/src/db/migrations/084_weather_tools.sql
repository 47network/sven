-- Migration 084: Weather tools (Open-Meteo)

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
    'tool_weather_current',
    'weather.current',
    'Weather Current',
    'Get current weather for a location using Open-Meteo.',
    'in_process',
    '{
      "type":"object",
      "properties":{"location":{"type":"string"}},
      "required":["location"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"location":{"type":"string"},"current":{"type":"object"},"current_units":{"type":"object"}}}'::jsonb,
    ARRAY['web.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":3}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_weather_forecast',
    'weather.forecast',
    'Weather Forecast',
    'Get multi-day weather forecast for a location using Open-Meteo.',
    'in_process',
    '{
      "type":"object",
      "properties":{"location":{"type":"string"},"days":{"type":"integer","minimum":1,"maximum":7,"default":3}},
      "required":["location"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"location":{"type":"string"},"current":{"type":"object"},"daily":{"type":"object"},"daily_units":{"type":"object"}}}'::jsonb,
    ARRAY['web.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":3}'::jsonb,
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

