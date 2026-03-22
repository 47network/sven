-- Migration 149: Register explicit wait tool for conversational agent flows

ALTER TABLE tools
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS timeout_seconds INT,
  ADD COLUMN IF NOT EXISTS max_memory_mb INT,
  ADD COLUMN IF NOT EXISTS max_cpu_shares INT;

UPDATE tools
SET
  category = COALESCE(NULLIF(BTRIM(category), ''), 'general'),
  timeout_seconds = COALESCE(timeout_seconds, 30),
  max_memory_mb = COALESCE(max_memory_mb, 256),
  max_cpu_shares = COALESCE(max_cpu_shares, 512)
WHERE
  category IS NULL OR BTRIM(category) = ''
  OR timeout_seconds IS NULL
  OR max_memory_mb IS NULL
  OR max_cpu_shares IS NULL;

INSERT INTO tools (
  id,
  name,
  category,
  description,
  execution_mode,
  is_first_party,
  trust_level,
  timeout_seconds,
  max_memory_mb,
  max_cpu_shares,
  inputs_schema,
  outputs_schema,
  permissions_required,
  resource_limits
)
VALUES (
  gen_random_uuid()::text,
  'wait.for',
  'agent_control',
  'Pause execution for a bounded duration and return timing metadata.',
  'in_process',
  TRUE,
  'trusted',
  305,
  64,
  128,
  '{
    "type":"object",
    "properties":{
      "delay_ms":{"type":"number","minimum":0,"maximum":300000,"description":"Wait duration in milliseconds"},
      "duration_ms":{"type":"number","minimum":0,"maximum":300000,"description":"Alias for delay_ms"},
      "seconds":{"type":"number","minimum":0,"maximum":300,"description":"Wait duration in seconds"},
      "reason":{"type":"string","maxLength":500,"description":"Optional operator-facing reason for waiting"}
    },
    "additionalProperties":false
  }'::jsonb,
  '{
    "type":"object",
    "properties":{
      "requested_wait_ms":{"type":"integer"},
      "actual_wait_ms":{"type":"integer"},
      "started_at":{"type":"string"},
      "ended_at":{"type":"string"},
      "reason":{"type":"string"}
    },
    "required":["requested_wait_ms","actual_wait_ms","started_at","ended_at"]
  }'::jsonb,
  ARRAY[]::text[],
  '{"max_bytes": 262144, "max_concurrency": 20}'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  execution_mode = EXCLUDED.execution_mode,
  is_first_party = EXCLUDED.is_first_party,
  trust_level = EXCLUDED.trust_level,
  timeout_seconds = EXCLUDED.timeout_seconds,
  max_memory_mb = EXCLUDED.max_memory_mb,
  max_cpu_shares = EXCLUDED.max_cpu_shares,
  inputs_schema = EXCLUDED.inputs_schema,
  outputs_schema = EXCLUDED.outputs_schema,
  permissions_required = EXCLUDED.permissions_required,
  resource_limits = EXCLUDED.resource_limits;
