-- ---------------------------------------------------------------------------
-- Migration: Revenue Pipeline + Infra Manager + Goals
-- Epic I.3 / I.4 / I.5.5 / I.8.2-I.8.4
-- ---------------------------------------------------------------------------

-- =========================================================================
-- I.3 — Revenue Pipeline Tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS revenue_pipelines (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('service_marketplace','product_deployment','content_creation','merchandise','custom')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived','error')),
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_revenue_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_revenue_pipelines_org ON revenue_pipelines (org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_pipelines_type ON revenue_pipelines (type);
CREATE INDEX IF NOT EXISTS idx_revenue_pipelines_status ON revenue_pipelines (status);

CREATE TABLE IF NOT EXISTS revenue_events (
    id              TEXT PRIMARY KEY,
    pipeline_id     TEXT NOT NULL REFERENCES revenue_pipelines(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,
    amount          NUMERIC(18,4) NOT NULL CHECK (amount > 0),
    fees            NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_amount      NUMERIC(18,4) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_pipeline ON revenue_events (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_created ON revenue_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_source ON revenue_events (source);

CREATE TABLE IF NOT EXISTS revenue_service_endpoints (
    id              TEXT PRIMARY KEY,
    pipeline_id     TEXT NOT NULL REFERENCES revenue_pipelines(id) ON DELETE CASCADE,
    skill_name      TEXT NOT NULL,
    path            TEXT NOT NULL,
    method          TEXT NOT NULL DEFAULT 'POST',
    price_per_call  NUMERIC(10,4) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    rate_limit      INTEGER NOT NULL DEFAULT 60,
    is_public       BOOLEAN NOT NULL DEFAULT false,
    description     TEXT NOT NULL DEFAULT '',
    total_calls     BIGINT NOT NULL DEFAULT 0,
    total_revenue   NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_products (
    id              TEXT PRIMARY KEY,
    pipeline_id     TEXT NOT NULL REFERENCES revenue_pipelines(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    domain          TEXT NOT NULL,
    pricing_model   TEXT NOT NULL CHECK (pricing_model IN ('free','freemium','subscription','one_time','usage_based')),
    monthly_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'USD',
    active_users    INTEGER NOT NULL DEFAULT 0,
    mrr             NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_merch_products (
    id              TEXT PRIMARY KEY,
    pipeline_id     TEXT NOT NULL REFERENCES revenue_pipelines(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('clothing','accessories','digital','print','other')),
    sku             TEXT NOT NULL UNIQUE,
    cost_price      NUMERIC(10,2) NOT NULL,
    sale_price      NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    inventory       INTEGER NOT NULL DEFAULT 0,
    total_sold      INTEGER NOT NULL DEFAULT 0,
    total_revenue   NUMERIC(18,2) NOT NULL DEFAULT 0,
    print_on_demand BOOLEAN NOT NULL DEFAULT false,
    design_asset_url TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_merch_orders (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES revenue_merch_products(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL,
    total_price     NUMERIC(12,2) NOT NULL,
    shipping_cost   NUMERIC(8,2) NOT NULL DEFAULT 0,
    platform_fee    NUMERIC(8,2) NOT NULL DEFAULT 0,
    net_revenue     NUMERIC(12,2) NOT NULL,
    customer_region TEXT NOT NULL DEFAULT 'unknown',
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','refunded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_product ON revenue_merch_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON revenue_merch_orders (status);

-- =========================================================================
-- I.4 — Infrastructure Management Tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS infra_nodes (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    hostname        TEXT NOT NULL,
    domain          TEXT NOT NULL,
    provider        TEXT NOT NULL,
    region          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('healthy','degraded','down','maintenance','provisioning')),
    resources       JSONB NOT NULL DEFAULT '{}'::jsonb,
    costs           JSONB NOT NULL DEFAULT '{}'::jsonb,
    services        TEXT[] NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_health_check TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_infra_nodes_org ON infra_nodes (org_id);
CREATE INDEX IF NOT EXISTS idx_infra_nodes_status ON infra_nodes (status);
CREATE INDEX IF NOT EXISTS idx_infra_nodes_domain ON infra_nodes (domain);

CREATE TABLE IF NOT EXISTS infra_health_log (
    id              BIGSERIAL PRIMARY KEY,
    node_id         TEXT NOT NULL REFERENCES infra_nodes(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL,
    latency_ms      INTEGER NOT NULL,
    services        JSONB NOT NULL DEFAULT '[]'::jsonb,
    resources       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_infra_health_node ON infra_health_log (node_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS infra_proposals (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    node_id         TEXT REFERENCES infra_nodes(id) ON DELETE SET NULL,
    proposal_type   TEXT NOT NULL CHECK (proposal_type IN ('scale_up','scale_down','migrate','new_node','decommission','optimize')),
    current_cost    NUMERIC(12,2) NOT NULL,
    proposed_cost   NUMERIC(12,2) NOT NULL,
    cost_delta      NUMERIC(12,2) NOT NULL,
    expected_benefit TEXT NOT NULL,
    risk_level      TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','executing','completed','failed','rejected')),
    approved_by     TEXT,
    execution_log   TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_infra_proposals_org ON infra_proposals (org_id);
CREATE INDEX IF NOT EXISTS idx_infra_proposals_status ON infra_proposals (status);

CREATE TABLE IF NOT EXISTS infra_deployments (
    id              TEXT PRIMARY KEY,
    node_id         TEXT NOT NULL REFERENCES infra_nodes(id) ON DELETE CASCADE,
    service_name    TEXT NOT NULL,
    version         TEXT NOT NULL,
    image           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','deploying','running','stopped','failed','rolled_back')),
    port            INTEGER NOT NULL,
    health_endpoint TEXT NOT NULL DEFAULT '/healthz',
    env_vars        TEXT[] NOT NULL DEFAULT '{}',
    cpu_limit       TEXT NOT NULL DEFAULT '1000m',
    memory_limit    TEXT NOT NULL DEFAULT '512Mi',
    replicas        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_deployments_node ON infra_deployments (node_id);
CREATE INDEX IF NOT EXISTS idx_infra_deployments_status ON infra_deployments (status);

-- =========================================================================
-- I.5.5 — Goal Tracking
-- =========================================================================

CREATE TABLE IF NOT EXISTS economy_goals (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('revenue','infrastructure','cost_reduction','performance','uptime','custom')),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    target_value    NUMERIC(18,4) NOT NULL,
    current_value   NUMERIC(18,4) NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL,
    deadline        TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','missed','cancelled')),
    milestones      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_goals_org ON economy_goals (org_id);
CREATE INDEX IF NOT EXISTS idx_economy_goals_status ON economy_goals (status);
CREATE INDEX IF NOT EXISTS idx_economy_goals_type ON economy_goals (type);

-- =========================================================================
-- Auto-update triggers
-- =========================================================================

CREATE OR REPLACE FUNCTION update_revenue_pipelines_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revenue_pipelines_updated_at BEFORE UPDATE ON revenue_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_revenue_pipelines_updated_at();

CREATE OR REPLACE FUNCTION update_infra_nodes_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_infra_nodes_updated_at BEFORE UPDATE ON infra_nodes
    FOR EACH ROW EXECUTE FUNCTION update_infra_nodes_updated_at();

CREATE OR REPLACE FUNCTION update_economy_goals_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_economy_goals_updated_at BEFORE UPDATE ON economy_goals
    FOR EACH ROW EXECUTE FUNCTION update_economy_goals_updated_at();
