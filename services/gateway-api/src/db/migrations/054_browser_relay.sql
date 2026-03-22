-- Migration 054: Browser relay sessions for extension-controlled user browser automation

CREATE TABLE IF NOT EXISTS browser_relay_sessions (
    id                       TEXT PRIMARY KEY,
    user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                     TEXT NOT NULL,
    status                   TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
    allowed_domains          JSONB NOT NULL DEFAULT '[]'::jsonb,
    permissions              JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_origins          JSONB NOT NULL DEFAULT '[]'::jsonb,
    extension_secret_hash    TEXT NOT NULL,
    max_command_age_seconds  INTEGER NOT NULL DEFAULT 300,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at               TIMESTAMPTZ NOT NULL,
    last_seen_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_browser_relay_sessions_user_created
  ON browser_relay_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_browser_relay_sessions_status_expires
  ON browser_relay_sessions(status, expires_at);

CREATE TABLE IF NOT EXISTS browser_relay_commands (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL REFERENCES browser_relay_sessions(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command       TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL CHECK (status IN ('queued', 'delivered', 'completed', 'error', 'denied', 'expired')),
    approval_id   TEXT REFERENCES approvals(id) ON DELETE SET NULL,
    result        JSONB NOT NULL DEFAULT '{}'::jsonb,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at  TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_browser_relay_commands_session_created
  ON browser_relay_commands(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_browser_relay_commands_session_status_created
  ON browser_relay_commands(session_id, status, created_at ASC);
