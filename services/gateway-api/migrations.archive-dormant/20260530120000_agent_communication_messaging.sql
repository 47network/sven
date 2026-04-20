-- Batch 57 — Agent Communication & Messaging
-- Channels, threads, direct messages, broadcast, and presence tracking

CREATE TABLE IF NOT EXISTS agent_channels (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  channel_type  TEXT NOT NULL CHECK (channel_type IN ('public','private','direct','broadcast','system')),
  topic         TEXT,
  created_by    TEXT NOT NULL,
  is_archived   BOOLEAN DEFAULT FALSE,
  max_members   INTEGER DEFAULT 100,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner','admin','member','guest','bot')),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  muted_until TIMESTAMPTZ,
  metadata    JSONB DEFAULT '{}',
  UNIQUE (channel_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL,
  thread_id   TEXT,
  content     TEXT NOT NULL,
  msg_type    TEXT NOT NULL CHECK (msg_type IN ('text','code','file','image','system','action','embed')),
  reply_to    TEXT,
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, agent_id, emoji)
);

CREATE TABLE IF NOT EXISTS agent_presence (
  agent_id      TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('online','away','busy','offline','dnd')),
  status_text   TEXT,
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  current_channel TEXT,
  metadata      JSONB DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_channels_type ON agent_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_agent_channels_created_by ON agent_channels(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_channels_archived ON agent_channels(is_archived);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_agent ON channel_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_role ON channel_members(role);
CREATE INDEX IF NOT EXISTS idx_agent_messages_channel ON agent_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_sender ON agent_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(msg_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_reply ON agent_messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_agent ON message_reactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);
CREATE INDEX IF NOT EXISTS idx_agent_presence_status ON agent_presence(status);
CREATE INDEX IF NOT EXISTS idx_agent_presence_last_seen ON agent_presence(last_seen_at);
