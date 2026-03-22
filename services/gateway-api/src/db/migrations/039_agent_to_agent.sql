-- Migration 039: Agent-to-agent sessions and messaging

CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    workspace_path  TEXT NOT NULL,
    model           TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'destroyed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id      TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    routing_rules   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_session
  ON agent_sessions(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inter_agent_messages (
    id                TEXT PRIMARY KEY,
    from_agent        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    to_agent          TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id        TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivered', 'responded', 'failed')),
    control_flags     JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_message  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at      TIMESTAMPTZ,
    responded_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inter_agent_messages_session
  ON inter_agent_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inter_agent_messages_agents
  ON inter_agent_messages(from_agent, to_agent, created_at DESC);

