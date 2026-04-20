BEGIN;

CREATE TABLE IF NOT EXISTS token_definitions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id        UUID NOT NULL,
  symbol          TEXT NOT NULL,
  name            TEXT NOT NULL,
  decimals        INTEGER NOT NULL DEFAULT 18,
  max_supply      BIGINT,
  current_supply  BIGINT NOT NULL DEFAULT 0,
  token_type      TEXT NOT NULL DEFAULT 'utility' CHECK (token_type IN ('utility','governance','reward','access','reputation')),
  mintable        BOOLEAN NOT NULL DEFAULT true,
  burnable        BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mint_operations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id        UUID NOT NULL REFERENCES token_definitions(id) ON DELETE CASCADE,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  recipient       TEXT NOT NULL,
  reason          TEXT NOT NULL DEFAULT 'reward' CHECK (reason IN ('reward','allocation','airdrop','staking','manual')),
  tx_hash         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','reverted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_balances (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id        UUID NOT NULL REFERENCES token_definitions(id) ON DELETE CASCADE,
  holder          TEXT NOT NULL,
  balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_id, holder)
);

CREATE INDEX IF NOT EXISTS idx_token_defs_agent ON token_definitions(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_defs_symbol ON token_definitions(symbol);
CREATE INDEX IF NOT EXISTS idx_mint_ops_token ON mint_operations(token_id);
CREATE INDEX IF NOT EXISTS idx_mint_ops_status ON mint_operations(status);
CREATE INDEX IF NOT EXISTS idx_token_bal_token ON token_balances(token_id);
CREATE INDEX IF NOT EXISTS idx_token_bal_holder ON token_balances(holder);

COMMIT;
