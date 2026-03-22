-- Migration 052: MCP chat overrides + discovered tool catalog

CREATE TABLE IF NOT EXISTS mcp_chat_overrides (
    id          TEXT PRIMARY KEY,
    chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    server_id   TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chat_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_mcp_chat_overrides_chat
  ON mcp_chat_overrides (chat_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS mcp_server_tools (
    id              TEXT PRIMARY KEY,
    server_id       TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    tool_name       TEXT NOT NULL,
    qualified_name  TEXT NOT NULL UNIQUE,
    description     TEXT,
    input_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_server_tools_server
  ON mcp_server_tools (server_id, updated_at DESC);

