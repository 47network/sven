-- Migration: Create pillar expansion tables
-- Supports: Design (P1), Model Router (P2), Documents (P3), Quantum (P4),
--           Security (P5), Trading (P6), Marketing (P7), Compute Mesh (P8)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 1 — Design Intelligence
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS design_audits (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL DEFAULT 'full',
  findings    JSONB NOT NULL DEFAULT '{}',
  score       REAL NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_audits_org ON design_audits(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 2 — Multi-Model & AI Agency
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_instances (
  id             UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  definition_id  TEXT NOT NULL,
  personality    TEXT NOT NULL DEFAULT 'default',
  goals          JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_instances_org ON agent_instances(org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS model_benchmark_runs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suite_id    TEXT NOT NULL,
  results     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_benchmarks_org ON model_benchmark_runs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 3 — OCR & Document Intelligence
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_jobs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  filename    TEXT NOT NULL DEFAULT 'inline',
  status      TEXT NOT NULL DEFAULT 'completed',
  result      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_jobs_org ON document_jobs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 4 — Quantum Computing Simulation
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quantum_jobs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  result      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quantum_jobs_org ON quantum_jobs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 5 — Security Toolkit
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS security_scans (
  id              UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  target          TEXT NOT NULL DEFAULT '',
  finding_count   INTEGER NOT NULL DEFAULT 0,
  severity_high   INTEGER NOT NULL DEFAULT 0,
  severity_medium INTEGER NOT NULL DEFAULT 0,
  severity_low    INTEGER NOT NULL DEFAULT 0,
  findings        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_scans_org ON security_scans(org_id, type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 6 — Trading Platform
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS trading_orders (
  id            UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('buy','sell')),
  type          TEXT NOT NULL CHECK (type IN ('market','limit','stop','stop_limit')),
  quantity      NUMERIC(20,8) NOT NULL,
  price         NUMERIC(20,8),
  stop_loss     NUMERIC(20,8),
  take_profit   NUMERIC(20,8),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','filled','partially_filled','cancelled','rejected')),
  risk_result   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trading_orders_org ON trading_orders(org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS trading_positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL,
  side             TEXT NOT NULL CHECK (side IN ('long','short')),
  quantity         NUMERIC(20,8) NOT NULL,
  avg_entry_price  NUMERIC(20,8) NOT NULL,
  current_price    NUMERIC(20,8) NOT NULL DEFAULT 0,
  unrealized_pnl   NUMERIC(20,8) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trading_positions_org ON trading_positions(org_id, status);

CREATE TABLE IF NOT EXISTS trading_performance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_trades    INTEGER NOT NULL DEFAULT 0,
  winning_trades  INTEGER NOT NULL DEFAULT 0,
  total_pnl       NUMERIC(20,8) NOT NULL DEFAULT 0,
  max_drawdown    NUMERIC(20,8) NOT NULL DEFAULT 0,
  sharpe_ratio    NUMERIC(10,4) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_performance_org ON trading_performance(org_id);

CREATE TABLE IF NOT EXISTS trading_predictions (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  horizon     TEXT NOT NULL DEFAULT '1h',
  prediction  JSONB NOT NULL DEFAULT '{}',
  ensemble    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trading_predictions_org ON trading_predictions(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trading_news_events (
  id              UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  headline        TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT '',
  impact_level    TEXT NOT NULL DEFAULT 'low',
  sentiment_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  entities        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trading_news_org ON trading_news_events(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 7 — Marketing Intelligence
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS marketing_competitors (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  profile     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_competitors_uniq ON marketing_competitors(org_id, url);

CREATE TABLE IF NOT EXISTS marketing_content (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'blog',
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  tone        TEXT NOT NULL DEFAULT 'professional',
  score       REAL NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_content_org ON marketing_content(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  objective   TEXT NOT NULL DEFAULT '',
  channels    JSONB NOT NULL DEFAULT '[]',
  budget      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  score       REAL NOT NULL DEFAULT 0,
  brief       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_org ON marketing_campaigns(org_id, status, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 8 — Federated Compute Mesh
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS compute_devices (
  id              UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname        TEXT NOT NULL,
  capabilities    JSONB NOT NULL DEFAULT '{}',
  tags            JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','busy','draining')),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compute_devices_uniq ON compute_devices(org_id, hostname);

CREATE TABLE IF NOT EXISTS compute_jobs (
  id               UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
  device_id        UUID,
  payload          JSONB NOT NULL DEFAULT '{}',
  result           JSONB,
  error            TEXT,
  progress_pct     INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_compute_jobs_org ON compute_jobs(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compute_jobs_device ON compute_jobs(device_id) WHERE device_id IS NOT NULL;

COMMIT;
