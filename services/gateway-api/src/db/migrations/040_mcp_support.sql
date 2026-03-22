-- Migration 040: MCP server registry and tool call logs

CREATE TABLE IF NOT EXISTS mcp_servers (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    transport         TEXT NOT NULL CHECK (transport IN ('stdio', 'http', 'sse')),
    url               TEXT NOT NULL,
    auth_token        TEXT,
    status            TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_connected    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_tool_calls (
    id            TEXT PRIMARY KEY,
    server_id     TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    tool_name     TEXT NOT NULL,
    input         JSONB NOT NULL DEFAULT '{}'::jsonb,
    output        JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_ms   INT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_server_time
  ON mcp_tool_calls(server_id, created_at DESC);

