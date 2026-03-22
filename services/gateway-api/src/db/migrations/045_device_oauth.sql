-- Migration 045: Device OAuth flow for companions

CREATE TABLE IF NOT EXISTS device_codes (
    id           TEXT PRIMARY KEY,
    device_code  TEXT NOT NULL UNIQUE,
    user_code    TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'pending',
    user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    client_name  TEXT,
    client_type  TEXT,
    scope        TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    approved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_codes_status
  ON device_codes(status, expires_at);
