-- ---------------------------------------------------------------------------
-- Migration: Sven Autonomous Economy — Treasury + Wallet
-- Epic I.3 (real wallet), I.4 (approvals), I.7 (treasury)
-- ---------------------------------------------------------------------------
-- Companion to 20260415200000_wallet_revenue_infra.sql which established
-- revenue/infra tables but **did not** create any wallet or treasury tables.
-- This migration adds the missing foundation so Sven can actually earn, hold,
-- and spend funds under human-configurable approval tiers.
-- ---------------------------------------------------------------------------

-- =========================================================================
-- Treasury Accounts — Sven's books (one per org, per currency)
-- =========================================================================

CREATE TABLE IF NOT EXISTS treasury_accounts (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('operating','reserve','compute','upgrade','escrow','external')),
    currency        TEXT NOT NULL DEFAULT 'USD',
    balance         NUMERIC(20,6) NOT NULL DEFAULT 0,
    available       NUMERIC(20,6) NOT NULL DEFAULT 0,
    reserved        NUMERIC(20,6) NOT NULL DEFAULT 0,
    wallet_id       TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    frozen          BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT treasury_accounts_nonneg CHECK (balance >= 0 AND available >= 0 AND reserved >= 0)
);

CREATE INDEX IF NOT EXISTS idx_treasury_accounts_org ON treasury_accounts (org_id);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_kind ON treasury_accounts (org_id, kind);

-- =========================================================================
-- Treasury Transactions — immutable double-entry ledger
-- =========================================================================

CREATE TABLE IF NOT EXISTS treasury_transactions (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    account_id      TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
    counter_account_id TEXT REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
    direction       TEXT NOT NULL CHECK (direction IN ('credit','debit')),
    amount          NUMERIC(20,6) NOT NULL CHECK (amount > 0),
    currency        TEXT NOT NULL DEFAULT 'USD',
    kind            TEXT NOT NULL CHECK (kind IN (
                        'revenue','payout','transfer','refund','fee','compute_cost',
                        'upgrade','donation','seed','reserve_move','adjustment'
                    )),
    source          TEXT NOT NULL,
    source_ref      TEXT,
    status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('pending','posted','failed','reversed')),
    approval_id     TEXT,
    risk_tier       TEXT NOT NULL DEFAULT 'auto' CHECK (risk_tier IN ('auto','notify','approve')),
    description     TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_org ON treasury_transactions (org_id);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_account ON treasury_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_status ON treasury_transactions (status);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_kind ON treasury_transactions (kind);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_source_ref ON treasury_transactions (source, source_ref);

-- =========================================================================
-- Treasury Limits — Sven-tunable, user override
-- Approval tiers:  auto ≤ auto_max  |  notify ≤ notify_max  |  approve > notify_max
-- Optional daily/weekly caps.
-- =========================================================================

CREATE TABLE IF NOT EXISTS treasury_limits (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    scope           TEXT NOT NULL CHECK (scope IN ('global','account','kind')),
    scope_ref       TEXT,
    currency        TEXT NOT NULL DEFAULT 'USD',
    auto_max        NUMERIC(20,6) NOT NULL DEFAULT 5,
    notify_max      NUMERIC(20,6) NOT NULL DEFAULT 50,
    daily_cap       NUMERIC(20,6),
    weekly_cap      NUMERIC(20,6),
    monthly_cap     NUMERIC(20,6),
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    set_by_user_id  TEXT,
    set_by_agent    BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_limits_org ON treasury_limits (org_id);
CREATE INDEX IF NOT EXISTS idx_treasury_limits_scope ON treasury_limits (org_id, scope, scope_ref);

-- =========================================================================
-- Crypto Wallets — one per treasury account that needs on-chain settlement.
-- Private key reference lives in secret-store; never stored in plaintext here.
-- =========================================================================

CREATE TABLE IF NOT EXISTS crypto_wallets (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    chain           TEXT NOT NULL CHECK (chain IN ('base','base-sepolia','ethereum','polygon','arbitrum','optimism')),
    network         TEXT NOT NULL DEFAULT 'mainnet' CHECK (network IN ('mainnet','testnet')),
    address         TEXT NOT NULL,
    label           TEXT NOT NULL DEFAULT '',
    derivation_path TEXT,
    secret_ref      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','revoked')),
    last_known_balance NUMERIC(32,18) NOT NULL DEFAULT 0,
    last_balance_at TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain, network, address)
);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_org ON crypto_wallets (org_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_chain ON crypto_wallets (chain, network);

-- =========================================================================
-- Crypto Transactions — on-chain tx tracking
-- =========================================================================

CREATE TABLE IF NOT EXISTS crypto_transactions (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    wallet_id       TEXT NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    chain           TEXT NOT NULL,
    network         TEXT NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('in','out')),
    tx_hash         TEXT,
    counterparty    TEXT,
    token_address   TEXT,
    token_symbol    TEXT NOT NULL DEFAULT 'ETH',
    token_decimals  INTEGER NOT NULL DEFAULT 18,
    amount          NUMERIC(40,18) NOT NULL CHECK (amount > 0),
    fee_wei         NUMERIC(40,0) NOT NULL DEFAULT 0,
    block_number    BIGINT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','confirmed','failed','dropped')),
    treasury_tx_id  TEXT REFERENCES treasury_transactions(id) ON DELETE SET NULL,
    approval_id     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crypto_tx_wallet ON crypto_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_tx_hash ON crypto_transactions (tx_hash);
CREATE INDEX IF NOT EXISTS idx_crypto_tx_status ON crypto_transactions (status);

-- =========================================================================
-- Backfill: link revenue_pipelines and infra_proposals to treasury_accounts.
-- Columns may already be implicit (JSON config); we add explicit FKs as nullable.
-- =========================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_pipelines') THEN
        ALTER TABLE revenue_pipelines
            ADD COLUMN IF NOT EXISTS treasury_account_id TEXT REFERENCES treasury_accounts(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_revenue_pipelines_treasury ON revenue_pipelines (treasury_account_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='infra_proposals') THEN
        ALTER TABLE infra_proposals
            ADD COLUMN IF NOT EXISTS treasury_account_id TEXT REFERENCES treasury_accounts(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_infra_proposals_treasury ON infra_proposals (treasury_account_id);
    END IF;
END $$;

-- =========================================================================
-- Default operating account seed (one per existing org, idempotent).
-- Balance = 0. Sven earns everything from scratch.
-- =========================================================================

INSERT INTO treasury_accounts (id, org_id, name, kind, currency, balance, available, reserved)
SELECT
    'tra_' || substr(md5(o.id || ':operating:USD'), 1, 24),
    o.id,
    'Operating',
    'operating',
    'USD',
    0, 0, 0
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM treasury_accounts t
    WHERE t.org_id = o.id AND t.kind = 'operating' AND t.currency = 'USD'
)
ON CONFLICT (id) DO NOTHING;
