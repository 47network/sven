-- Migration 096: Media analysis tool (audio/video/image)

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
    'tool_analyze_media',
    'analyze.media',
    'Analyze Media',
    'Analyze audio/video/image media. Audio: transcription + summary. Video/image: key frame descriptions.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "path":{"type":"string"},
        "url":{"type":"string"},
        "media_type":{"type":"string","enum":["audio","video","image"]},
        "max_bytes":{"type":"integer","minimum":1,"maximum":104857600},
        "language":{"type":"string"},
        "frame_interval_sec":{"type":"number","minimum":1},
        "max_frames":{"type":"integer","minimum":1,"maximum":20}
      },
      "oneOf":[
        {"required":["path"]},
        {"required":["url"]}
      ],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "media_type":{"type":"string"},
        "source":{"type":"string"},
        "size_bytes":{"type":"integer"},
        "transcript":{"type":"string"},
        "summary":{"type":"string"},
        "topics":{"type":"array","items":{"type":"string"}},
        "key_frames":{
          "type":"array",
          "items":{
            "type":"object",
            "properties":{
              "timestamp":{"type":["number","null"]},
              "description":{"type":"string"},
              "image_path":{"type":["string","null"]}
            }
          }
        },
        "warnings":{"type":"array","items":{"type":"string"}}
      }
    }'::jsonb,
    ARRAY['media.read']::text[],
    '{"timeout_ms":120000,"max_bytes":104857600,"max_concurrency":2}'::jsonb,
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
