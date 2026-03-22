-- Migration 049: SOUL signatures + trust metadata

BEGIN;

CREATE TABLE IF NOT EXISTS souls_signatures (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  soul_id         TEXT NOT NULL REFERENCES souls_catalog(id) ON DELETE CASCADE,
  signature_type  TEXT NOT NULL DEFAULT 'ed25519',
  signature       TEXT NOT NULL,
  public_key      TEXT NOT NULL,
  fingerprint     TEXT NOT NULL,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  trusted         BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_souls_signatures_soul ON souls_signatures(soul_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_souls_signatures_trusted ON souls_signatures(trusted, verified);

COMMIT;
