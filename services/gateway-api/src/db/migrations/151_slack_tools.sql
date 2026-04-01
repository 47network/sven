-- Migration 151: Slack platform tools
-- Enables Sven to post messages, manage channels, and invite users on Slack.
-- Token is read from setting slack.bot_token_ref (secret ref) or SLACK_BOT_TOKEN env.

-- ── Tool registrations ────────────────────────────────────────────────────────

INSERT INTO tools (id, name, display_name, description, execution_mode,
                   inputs_schema, outputs_schema, permissions_required,
                   resource_limits, is_first_party, trust_level,
                   created_at, updated_at)
VALUES

-- slack.post_message
('tool_slack_post_message',
 'slack.post_message',
 'Slack – Post Message',
 'Post a message to any Slack channel or DM. Supports plain text and markdown.',
 'in_process',
 '{
   "type":"object",
   "properties":{
     "channel":{"type":"string","description":"Channel name (e.g. general) or ID, or user ID for DM"},
     "text":{"type":"string","description":"Message text (markdown supported)"},
     "thread_ts":{"type":"string","description":"Optional: reply in a thread by providing the parent message timestamp"}
   },
   "required":["channel","text"],
   "additionalProperties":false
 }'::jsonb,
 '{
   "type":"object",
   "properties":{
     "ok":{"type":"boolean"},
     "ts":{"type":"string","description":"Message timestamp"},
     "channel":{"type":"string"}
   }
 }'::jsonb,
 ARRAY['slack.write']::text[],
 '{"timeout_ms":10000,"max_bytes":65536,"max_concurrency":4}'::jsonb,
 TRUE, 'trusted', NOW(), NOW()),

-- slack.create_channel
('tool_slack_create_channel',
 'slack.create_channel',
 'Slack – Create Channel',
 'Create a new public or private Slack channel.',
 'in_process',
 '{
   "type":"object",
   "properties":{
     "name":{"type":"string","description":"Channel name (lowercase, no spaces, use hyphens)"},
     "is_private":{"type":"boolean","default":false,"description":"Set true for a private channel"}
   },
   "required":["name"],
   "additionalProperties":false
 }'::jsonb,
 '{
   "type":"object",
   "properties":{
     "ok":{"type":"boolean"},
     "channel_id":{"type":"string"},
     "channel_name":{"type":"string"}
   }
 }'::jsonb,
 ARRAY['slack.write']::text[],
 '{"timeout_ms":10000,"max_bytes":65536,"max_concurrency":2}'::jsonb,
 TRUE, 'trusted', NOW(), NOW()),

-- slack.invite_user
('tool_slack_invite_user',
 'slack.invite_user',
 'Slack – Invite User to Channel',
 'Invite one or more users to a Slack channel by email address or Slack user ID.',
 'in_process',
 '{
   "type":"object",
   "properties":{
     "channel":{"type":"string","description":"Channel name or ID"},
     "users":{"type":"array","items":{"type":"string"},"description":"List of email addresses or Slack user IDs"}
   },
   "required":["channel","users"],
   "additionalProperties":false
 }'::jsonb,
 '{
   "type":"object",
   "properties":{
     "ok":{"type":"boolean"},
     "invited_count":{"type":"integer"}
   }
 }'::jsonb,
 ARRAY['slack.write']::text[],
 '{"timeout_ms":15000,"max_bytes":65536,"max_concurrency":2}'::jsonb,
 TRUE, 'trusted', NOW(), NOW()),

-- slack.list_channels
('tool_slack_list_channels',
 'slack.list_channels',
 'Slack – List Channels',
 'List public (and optionally private) channels in the workspace.',
 'in_process',
 '{
   "type":"object",
   "properties":{
     "include_private":{"type":"boolean","default":false},
     "limit":{"type":"integer","minimum":1,"maximum":200,"default":50}
   },
   "additionalProperties":false
 }'::jsonb,
 '{
   "type":"object",
   "properties":{
     "ok":{"type":"boolean"},
     "channels":{
       "type":"array",
       "items":{
         "type":"object",
         "properties":{
           "id":{"type":"string"},
           "name":{"type":"string"},
           "is_private":{"type":"boolean"},
           "num_members":{"type":"integer"},
           "topic":{"type":"string"}
         }
       }
     }
   }
 }'::jsonb,
 ARRAY['slack.read']::text[],
 '{"timeout_ms":10000,"max_bytes":131072,"max_concurrency":4}'::jsonb,
 TRUE, 'trusted', NOW(), NOW()),

-- slack.list_members
('tool_slack_list_members',
 'slack.list_members',
 'Slack – List Channel Members',
 'List members of a Slack channel.',
 'in_process',
 '{
   "type":"object",
   "properties":{
     "channel":{"type":"string","description":"Channel name or ID"},
     "limit":{"type":"integer","minimum":1,"maximum":200,"default":50}
   },
   "required":["channel"],
   "additionalProperties":false
 }'::jsonb,
 '{
   "type":"object",
   "properties":{
     "ok":{"type":"boolean"},
     "members":{
       "type":"array",
       "items":{
         "type":"object",
         "properties":{
           "id":{"type":"string"},
           "name":{"type":"string"},
           "display_name":{"type":"string"},
           "email":{"type":"string"}
         }
       }
     }
   }
 }'::jsonb,
 ARRAY['slack.read']::text[],
 '{"timeout_ms":10000,"max_bytes":131072,"max_concurrency":4}'::jsonb,
 TRUE, 'trusted', NOW(), NOW())

ON CONFLICT (name) DO UPDATE
SET
  display_name        = EXCLUDED.display_name,
  description         = EXCLUDED.description,
  execution_mode      = EXCLUDED.execution_mode,
  inputs_schema       = EXCLUDED.inputs_schema,
  outputs_schema      = EXCLUDED.outputs_schema,
  permissions_required = EXCLUDED.permissions_required,
  resource_limits     = EXCLUDED.resource_limits,
  is_first_party      = EXCLUDED.is_first_party,
  trust_level         = EXCLUDED.trust_level,
  updated_at          = NOW();

-- ── Default settings ──────────────────────────────────────────────────────────

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('slack.bot_token_ref', 'null'::jsonb, NOW(), 'migration:151_slack_tools'),
  ('slack.default_channel', '"general"'::jsonb, NOW(), 'migration:151_slack_tools')
ON CONFLICT (key) DO NOTHING;
