-- Migration 088: Scheduler tools (user-facing schedules via chat)

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
    'tool_schedule_create',
    'schedule.create',
    'Schedule Create',
    'Create a scheduled task for the user (one-time or recurring).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "user_id":{"type":"string"},
        "name":{"type":"string"},
        "instruction":{"type":"string"},
        "schedule_type":{"type":"string","enum":["once","recurring"],"default":"recurring"},
        "expression":{"type":"string"},
        "run_at":{"type":"string"},
        "timezone":{"type":"string"},
        "enabled":{"type":"boolean"},
        "agent_id":{"type":"string"},
        "chat_id":{"type":"string"},
        "max_runs":{"type":"integer"},
        "missed_policy":{"type":"string","enum":["skip","run_immediately"]}
      },
      "required":["user_id","name","instruction"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "name":{"type":"string"},
        "schedule_type":{"type":"string"},
        "expression":{"type":"string"},
        "run_at":{"type":"string"},
        "next_run":{"type":"string"},
        "enabled":{"type":"boolean"},
        "message":{"type":"string"}
      }
    }'::jsonb,
    ARRAY['schedules.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_schedule_list',
    'schedule.list',
    'Schedule List',
    'List scheduled tasks for the user.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "user_id":{"type":"string"}
      },
      "required":["user_id"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "tasks":{"type":"array","items":{"type":"object"}},
        "count":{"type":"integer"}
      }
    }'::jsonb,
    ARRAY['schedules.read']::text[],
    '{"timeout_ms":10000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_schedule_cancel',
    'schedule.cancel',
    'Schedule Cancel',
    'Cancel a scheduled task by id for the user.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "user_id":{"type":"string"},
        "task_id":{"type":"string"}
      },
      "required":["user_id","task_id"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "name":{"type":"string"},
        "message":{"type":"string"}
      }
    }'::jsonb,
    ARRAY['schedules.write']::text[],
    '{"timeout_ms":10000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_schedule_toggle',
    'schedule.toggle',
    'Schedule Toggle',
    'Enable or disable a scheduled task by id for the user.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "user_id":{"type":"string"},
        "task_id":{"type":"string"},
        "enabled":{"type":"boolean"}
      },
      "required":["user_id","task_id","enabled"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "id":{"type":"string"},
        "name":{"type":"string"},
        "enabled":{"type":"boolean"},
        "message":{"type":"string"}
      }
    }'::jsonb,
    ARRAY['schedules.write']::text[],
    '{"timeout_ms":10000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
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
