-- Add ha.list_entities and ha.list_devices read tools
INSERT INTO tools (
  name,
  description,
  enabled,
  permissions_required,
  inputs_schema,
  outputs_schema,
  max_memory_mb,
  max_cpu_shares,
  max_bytes,
  timeout_seconds,
  execution_mode,
  created_at
) VALUES
(
  'ha.list_entities',
  'Lists all entities/state objects from Home Assistant. Returns entity_id, state, attributes, last_updated for each.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "filter_domain": {
        "type": "string",
        "description": "Optional domain filter (e.g., ''light'', ''switch'', ''climate'', etc.)"
      }
    },
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "entities": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entity_id": { "type": "string" },
            "state": { "type": "string" },
            "attributes": { "type": "object" },
            "last_updated": { "type": "string" }
          }
        }
      }
    }
  }'::JSONB,
  64,
  256,
  1048576,
  10,
  'in_process',
  NOW()
),
(
  'ha.list_devices',
  'Lists all devices registered in Home Assistant. Returns device_id, name, manufacturer, model, area_id, etc.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "filter_manufacturer": {
        "type": "string",
        "description": "Optional manufacturer filter (e.g., ''Philips'', ''IKEA'', etc.)"
      },
      "filter_model": {
        "type": "string",
        "description": "Optional model filter"
      }
    },
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "devices": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "name": { "type": ["string", "null"] },
            "name_by_user": { "type": ["string", "null"] },
            "manufacturer": { "type": ["string", "null"] },
            "model": { "type": ["string", "null"] },
            "area_id": { "type": ["string", "null"] },
            "primary_config_entry_id": { "type": ["string", "null"] }
          }
        }
      }
    }
  }'::JSONB,
  64,
  256,
  2097152,
  15,
  'in_process',
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  permissions_required = EXCLUDED.permissions_required,
  inputs_schema = EXCLUDED.inputs_schema,
  outputs_schema = EXCLUDED.outputs_schema,
  max_memory_mb = EXCLUDED.max_memory_mb,
  max_cpu_shares = EXCLUDED.max_cpu_shares,
  max_bytes = EXCLUDED.max_bytes,
  timeout_seconds = EXCLUDED.timeout_seconds,
  execution_mode = EXCLUDED.execution_mode;
