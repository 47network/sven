-- Migration 038: DM pairing requests and allowlist approvals

CREATE TABLE IF NOT EXISTS pairing_requests (
    id           TEXT PRIMARY KEY,
    channel      TEXT NOT NULL,
    sender_id    TEXT NOT NULL,
    code         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    approved_by  TEXT REFERENCES users(id),
    approved_at  TIMESTAMPTZ,
    denied_by    TEXT REFERENCES users(id),
    denied_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_channel_code
  ON pairing_requests(channel, code, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_sender
  ON pairing_requests(channel, sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_allowlists (
    id           TEXT PRIMARY KEY,
    channel      TEXT NOT NULL,
    sender_id    TEXT NOT NULL,
    approved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by  TEXT REFERENCES users(id),
    UNIQUE(channel, sender_id)
);

