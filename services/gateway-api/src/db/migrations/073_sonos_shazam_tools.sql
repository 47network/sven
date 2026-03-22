-- Migration 073: Sonos + Shazam integration tools

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
    'tool_sonos_list_households',
    'sonos.list_households',
    'Sonos List Households',
    'List Sonos households visible to the configured Sonos account token.',
    'in_process',
    '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
    '{"type":"object","properties":{"households":{"type":"array","items":{"type":"object"}}}}'::jsonb,
    ARRAY['music.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_sonos_list_groups',
    'sonos.list_groups',
    'Sonos List Groups',
    'List Sonos playback groups for a household.',
    'in_process',
    '{
      "type":"object",
      "properties":{"household_id":{"type":"string"}},
      "required":["household_id"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"groups":{"type":"array","items":{"type":"object"}}}}'::jsonb,
    ARRAY['music.read']::text[],
    '{"timeout_ms":15000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_sonos_playback',
    'sonos.playback',
    'Sonos Playback',
    'Control Sonos playback on a group (play, pause, next, previous).',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "group_id":{"type":"string"},
        "action":{"type":"string","enum":["play","pause","skipToNextTrack","skipToPreviousTrack"]}
      },
      "required":["group_id","action"],
      "additionalProperties":false
    }'::jsonb,
    '{"type":"object","properties":{"ok":{"type":"boolean"},"group_id":{"type":"string"},"action":{"type":"string"}}}'::jsonb,
    ARRAY['music.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_shazam_recognize',
    'shazam.recognize',
    'Shazam Recognize',
    'Recognize a song from an audio URL using Shazam-compatible audio fingerprint APIs.',
    'in_process',
    '{
      "type":"object",
      "properties":{"audio_url":{"type":"string"}},
      "required":["audio_url"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "matched":{"type":"boolean"},
        "provider":{"type":"string"},
        "title":{"type":"string"},
        "artist":{"type":"string"},
        "album":{"type":"string"},
        "song_link":{"type":"string"}
      }
    }'::jsonb,
    ARRAY['media.read']::text[],
    '{"timeout_ms":20000,"max_bytes":2097152,"max_concurrency":2}'::jsonb,
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

