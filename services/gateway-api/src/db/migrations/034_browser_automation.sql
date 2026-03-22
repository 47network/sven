-- Migration 034: Browser automation profiles and sessions

CREATE TABLE IF NOT EXISTS browser_profiles (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    storage_path TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS browser_sessions (
    id            TEXT PRIMARY KEY,
    profile_id    TEXT NOT NULL REFERENCES browser_profiles(id) ON DELETE CASCADE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMPTZ,
    pages_visited INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_profile
  ON browser_sessions(profile_id, started_at DESC);
