-- Batch 47: Agent Marketplace Analytics
-- Tracks marketplace performance, agent productivity, revenue trends,
-- task completion patterns, and buyer/seller analytics.

BEGIN;

-- Marketplace performance snapshots (periodic rollups)
CREATE TABLE IF NOT EXISTS marketplace_analytics_snapshots (
  id            TEXT PRIMARY KEY,
  period_type   TEXT NOT NULL CHECK (period_type IN ('hourly','daily','weekly','monthly','quarterly','yearly')),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  total_tasks   INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks  INTEGER NOT NULL DEFAULT 0,
  cancelled_tasks INTEGER NOT NULL DEFAULT 0,
  total_revenue_tokens NUMERIC(20,8) NOT NULL DEFAULT 0,
  avg_completion_time_ms BIGINT NOT NULL DEFAULT 0,
  unique_sellers INTEGER NOT NULL DEFAULT 0,
  unique_buyers  INTEGER NOT NULL DEFAULT 0,
  top_categories JSONB NOT NULL DEFAULT '[]',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent productivity metrics (per-agent rollups)
CREATE TABLE IF NOT EXISTS agent_productivity_metrics (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  period_type   TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  period_start  TIMESTAMPTZ NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_failed  INTEGER NOT NULL DEFAULT 0,
  tasks_in_progress INTEGER NOT NULL DEFAULT 0,
  avg_quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_earnings_tokens NUMERIC(20,8) NOT NULL DEFAULT 0,
  avg_response_time_ms BIGINT NOT NULL DEFAULT 0,
  skill_utilization JSONB NOT NULL DEFAULT '{}',
  efficiency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue trend tracking (granular revenue events)
CREATE TABLE IF NOT EXISTS revenue_trend_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN ('task_payment','listing_sale','subscription_fee','tip','refund','penalty','bonus','commission')),
  source_id     TEXT NOT NULL,
  seller_agent_id TEXT,
  buyer_agent_id TEXT,
  amount_tokens NUMERIC(20,8) NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'uncategorized',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB NOT NULL DEFAULT '{}'
);

-- Category performance (per-category analytics)
CREATE TABLE IF NOT EXISTS category_performance (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  period_type   TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  period_start  TIMESTAMPTZ NOT NULL,
  task_count    INTEGER NOT NULL DEFAULT 0,
  revenue_tokens NUMERIC(20,8) NOT NULL DEFAULT 0,
  avg_rating    NUMERIC(3,2) NOT NULL DEFAULT 0,
  growth_rate   NUMERIC(8,4) NOT NULL DEFAULT 0,
  top_sellers   JSONB NOT NULL DEFAULT '[]',
  demand_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marketplace health indicators (system-wide health checks)
CREATE TABLE IF NOT EXISTS marketplace_health_indicators (
  id            TEXT PRIMARY KEY,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN ('liquidity','velocity','concentration','satisfaction','fraud_risk','growth','churn','retention')),
  value         NUMERIC(12,4) NOT NULL DEFAULT 0,
  threshold_low NUMERIC(12,4),
  threshold_high NUMERIC(12,4),
  status        TEXT NOT NULL CHECK (status IN ('healthy','warning','critical','unknown')) DEFAULT 'unknown',
  details       JSONB NOT NULL DEFAULT '{}',
  measured_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period ON marketplace_analytics_snapshots(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_created ON marketplace_analytics_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_productivity_agent ON agent_productivity_metrics(agent_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_productivity_period ON agent_productivity_metrics(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_productivity_efficiency ON agent_productivity_metrics(efficiency_score DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_event_type ON revenue_trend_events(event_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_revenue_seller ON revenue_trend_events(seller_agent_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_revenue_buyer ON revenue_trend_events(buyer_agent_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_revenue_category ON revenue_trend_events(category, recorded_at);
CREATE INDEX IF NOT EXISTS idx_category_perf_cat ON category_performance(category, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_category_perf_demand ON category_performance(demand_score DESC);
CREATE INDEX IF NOT EXISTS idx_category_perf_growth ON category_performance(growth_rate DESC);
CREATE INDEX IF NOT EXISTS idx_health_type ON marketplace_health_indicators(indicator_type, measured_at);
CREATE INDEX IF NOT EXISTS idx_health_status ON marketplace_health_indicators(status, measured_at);
CREATE INDEX IF NOT EXISTS idx_health_measured ON marketplace_health_indicators(measured_at);

COMMIT;
