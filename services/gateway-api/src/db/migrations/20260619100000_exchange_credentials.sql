-- ═══════════════════════════════════════════════════════════════════════════
-- Exchange Credentials: secure storage for broker API keys
-- ═══════════════════════════════════════════════════════════════════════════
-- Stores encrypted API keys for Binance, Bybit, Alpaca, and future exchanges.
-- Keys are encrypted at the application layer before storage.
-- UNIQUE constraint on (org_id, broker) ensures one credential set per exchange per org.

BEGIN;

CREATE TABLE IF NOT EXISTS exchange_credentials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker       TEXT NOT NULL CHECK (broker IN ('alpaca', 'ccxt_binance', 'ccxt_bybit')),
  api_key_enc  TEXT NOT NULL,
  api_secret_enc TEXT NOT NULL,
  is_paper     BOOLEAN NOT NULL DEFAULT true,
  endpoint     TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  label        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  UNIQUE(org_id, broker)
);

-- Fast lookup for active credentials by org
CREATE INDEX IF NOT EXISTS idx_exchange_creds_org_active
  ON exchange_credentials (org_id, broker) WHERE status = 'active';

COMMIT;
