-- Migration 072: Spotify integration tools

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
    'tool_spotify_search',
    'spotify.search',
    'Spotify Search',
    'Search Spotify tracks, artists, albums, playlists, shows, and episodes.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string","description":"Search query"},
        "type":{"type":"string","enum":["track","artist","album","playlist","show","episode"],"default":"track"},
        "limit":{"type":"integer","minimum":1,"maximum":50,"default":10},
        "market":{"type":"string","description":"ISO market code (optional)"}
      },
      "required":["query"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "query":{"type":"string"},
        "type":{"type":"string"},
        "total":{"type":"integer"},
        "items":{"type":"array","items":{"type":"object"}}
      }
    }'::jsonb,
    ARRAY['music.read']::text[],
    '{"timeout_ms":15000,"max_bytes":5242880,"max_concurrency":3}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_spotify_play',
    'spotify.play',
    'Spotify Play',
    'Start/resume Spotify playback. Supports optional context URI or explicit track URIs.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "access_token":{"type":"string","description":"Spotify user access token (required unless env fallback set)"},
        "device_id":{"type":"string"},
        "context_uri":{"type":"string"},
        "uris":{"type":"array","items":{"type":"string"}}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "ok":{"type":"boolean"},
        "action":{"type":"string"},
        "device_id":{"type":["string","null"]}
      }
    }'::jsonb,
    ARRAY['music.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_spotify_pause',
    'spotify.pause',
    'Spotify Pause',
    'Pause active Spotify playback.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "access_token":{"type":"string","description":"Spotify user access token (required unless env fallback set)"},
        "device_id":{"type":"string"}
      },
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "ok":{"type":"boolean"},
        "action":{"type":"string"},
        "device_id":{"type":["string","null"]}
      }
    }'::jsonb,
    ARRAY['music.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
    TRUE,
    'trusted',
    NOW(),
    NOW()
  ),
  (
    'tool_spotify_queue',
    'spotify.queue',
    'Spotify Queue',
    'Add a track URI to the active Spotify playback queue.',
    'in_process',
    '{
      "type":"object",
      "properties":{
        "access_token":{"type":"string","description":"Spotify user access token (required unless env fallback set)"},
        "device_id":{"type":"string"},
        "uri":{"type":"string","description":"Track URI, e.g. spotify:track:..."}
      },
      "required":["uri"],
      "additionalProperties":false
    }'::jsonb,
    '{
      "type":"object",
      "properties":{
        "ok":{"type":"boolean"},
        "action":{"type":"string"},
        "device_id":{"type":["string","null"]}
      }
    }'::jsonb,
    ARRAY['music.write']::text[],
    '{"timeout_ms":15000,"max_bytes":1048576,"max_concurrency":2}'::jsonb,
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

