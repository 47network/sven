-- ---------------------------------------------------------------------------
-- Migration: Sven Marketplace (market.sven.systems)
-- Batch 2 — listings, orders, fulfillments, payouts
-- ---------------------------------------------------------------------------

-- Listings: a sellable thing. Backed by a skill, product, or service endpoint.
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    seller_agent_id TEXT,
    slug            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    kind            TEXT NOT NULL CHECK (kind IN ('skill_api', 'digital_good', 'service', 'dataset', 'model')),
    pricing_model   TEXT NOT NULL CHECK (pricing_model IN ('one_time', 'per_call', 'subscription', 'usage_based')),
    unit_price      NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
    currency        TEXT NOT NULL DEFAULT 'USD',
    payout_account_id TEXT,
    skill_name      TEXT,
    endpoint_url    TEXT,
    pipeline_id     TEXT,
    cover_image_url TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','retired')),
    total_sales     INTEGER NOT NULL DEFAULT 0,
    total_revenue   NUMERIC(18,4) NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_org ON marketplace_listings (org_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings (status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_kind ON marketplace_listings (kind);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_slug ON marketplace_listings (slug);

-- Orders: a buyer committed to buy. Status tracks the payment + fulfillment
-- lifecycle so settlement is idempotent.
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id              TEXT PRIMARY KEY,
    listing_id      TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
    buyer_id        TEXT,
    buyer_email     TEXT,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price      NUMERIC(14,4) NOT NULL,
    subtotal        NUMERIC(14,4) NOT NULL,
    platform_fee    NUMERIC(14,4) NOT NULL DEFAULT 0,
    total           NUMERIC(14,4) NOT NULL,
    net_to_seller   NUMERIC(14,4) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    payment_method  TEXT NOT NULL CHECK (payment_method IN ('stripe','crypto_base','internal_credit')),
    payment_ref     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','refunded','failed','cancelled')),
    settlement_tx_id TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at         TIMESTAMPTZ,
    fulfilled_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_listing ON marketplace_orders (listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders (status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON marketplace_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created ON marketplace_orders (created_at DESC);

-- Fulfillments: proof of delivery. For a skill_api, this records the
-- invocation result; for a digital good, the download URL; etc.
CREATE TABLE IF NOT EXISTS marketplace_fulfillments (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','delivered','failed')),
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_fulfillments_order ON marketplace_fulfillments (order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_fulfillments_status ON marketplace_fulfillments (status);

-- Seller payouts: aggregated net-to-seller disbursements. The treasury
-- ledger holds the definitive debit/credit; this table tracks batches.
CREATE TABLE IF NOT EXISTS marketplace_payouts (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    listing_id      TEXT REFERENCES marketplace_listings(id) ON DELETE SET NULL,
    payout_account_id TEXT NOT NULL,
    amount          NUMERIC(18,4) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    order_count     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    treasury_tx_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_org ON marketplace_payouts (org_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_status ON marketplace_payouts (status);

COMMENT ON TABLE marketplace_listings IS 'Sven marketplace catalog — skills, goods, services Sven sells.';
COMMENT ON TABLE marketplace_orders IS 'Buyer orders. Settled via treasury ledger.';
COMMENT ON TABLE marketplace_fulfillments IS 'Delivery proofs per order (skill invocation, download, etc.).';
COMMENT ON TABLE marketplace_payouts IS 'Batched payouts to seller treasury accounts.';
