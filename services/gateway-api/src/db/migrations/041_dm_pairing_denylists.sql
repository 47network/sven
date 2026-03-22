-- Migration 041: DM pairing denylist support

CREATE TABLE IF NOT EXISTS channel_denylists (
    id           TEXT PRIMARY KEY,
    channel      TEXT NOT NULL,
    sender_id    TEXT NOT NULL,
    denied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    denied_by    TEXT REFERENCES users(id),
    UNIQUE(channel, sender_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_denylists_lookup
  ON channel_denylists(channel, sender_id);
