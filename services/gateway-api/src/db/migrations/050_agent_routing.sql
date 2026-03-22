-- Migration 050: Agent routing rules + per-agent config

CREATE TABLE IF NOT EXISTS agent_configs (
    agent_id        TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    system_prompt   TEXT NOT NULL DEFAULT '',
    model_name      TEXT,
    profile_name    TEXT,
    settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_routing_rules (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id          TEXT REFERENCES chats(id) ON DELETE SET NULL,
    channel             TEXT NOT NULL,
    channel_chat_id     TEXT,
    user_id             TEXT,
    sender_identity_id  TEXT,
    priority            INT NOT NULL DEFAULT 100,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_routing_rules_channel
  ON agent_routing_rules (channel, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_routing_rules_agent
  ON agent_routing_rules (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_routing_rules_user
  ON agent_routing_rules (user_id);

