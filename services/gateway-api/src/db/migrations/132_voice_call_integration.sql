-- Migration 132: Voice call integration defaults + tool registry entry

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'voice.call.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'voice.call.enabled'
);

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
  'voice.call.place',
  'Voice Call Place',
  'Place an outbound phone call through the configured voice-call adapter provider.',
  'in_process',
  ARRAY['voice.write']::text[],
  '{"type":"object","properties":{"provider":{"type":"string","enum":["mock","twilio","telnyx","plivo"]},"to":{"type":"string"},"from":{"type":"string"},"approval_id":{"type":"string"},"chat_id":{"type":"string"},"sender_identity_id":{"type":"string"},"metadata":{"type":"object"}},"required":["to"],"additionalProperties":true}',
  '{"type":"object","properties":{"provider":{"type":"string"},"call_id":{"type":"string"}},"required":["provider","call_id"]}',
  true,
  'trusted'
WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = 'voice.call.place');
