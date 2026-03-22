-- Migration 093: Register image-generation and email-generic dynamic skill tools

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
    'tool_image_generation',
    'image-generation',
    'Image Generation',
    'Generate images via OpenAI or Stable Diffusion using a local skill handler.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "prompt":{"type":"string"},
        "provider":{"type":"string","enum":["openai","stable_diffusion"],"default":"openai"},
        "size":{"type":"string","enum":["256x256","512x512","1024x1024","1024x768","768x1024"],"default":"1024x1024"},
        "n":{"type":"integer","minimum":1,"maximum":4,"default":1},
        "style":{"type":"string","default":""}
      },
      "required":["prompt"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "provider":{"type":"string"},
        "model":{"type":"string"},
        "images":{
          "type":"array",
          "items":{
            "type":"object",
            "properties":{
              "data_url":{"type":"string"},
              "seed":{"type":"number"},
              "width":{"type":"number"},
              "height":{"type":"number"}
            },
            "required":["data_url"]
          }
        }
      },
      "required":["images"]
    }'::jsonb,
    ARRAY['image.generate']::text[],
    '{"timeout_ms":45000,"max_bytes":8388608,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_email_generic',
    'email-generic',
    'Email (Generic)',
    'Send/search email via a generic IMAP/SMTP bridge.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "action":{"type":"string","enum":["send","search","list"],"default":"send"},
        "to":{"type":"array","items":{"type":"string"}},
        "cc":{"type":"array","items":{"type":"string"}},
        "bcc":{"type":"array","items":{"type":"string"}},
        "subject":{"type":"string"},
        "body":{"type":"string"},
        "query":{"type":"string"},
        "limit":{"type":"integer","minimum":1,"maximum":50,"default":10}
      },
      "required":["action"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "action":{"type":"string"},
        "result":{"type":"object"},
        "items":{"type":"array","items":{"type":"object"}}
      },
      "required":["action"]
    }'::jsonb,
    ARRAY['email.send']::text[],
    '{"timeout_ms":30000,"max_bytes":4194304,"max_concurrency":2}'::jsonb,
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
