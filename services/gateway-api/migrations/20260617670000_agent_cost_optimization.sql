-- Batch 130: Agent Cost Optimization
-- Cloud spend analysis, right-sizing recommendations, budget alerts

CREATE TABLE IF NOT EXISTS agent_cost_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  report_period   TEXT NOT NULL CHECK (report_period IN ('hourly','daily','weekly','monthly')),
  provider        TEXT NOT NULL CHECK (provider IN ('aws','gcp','azure','hetzner','self_hosted','mixed')),
  total_cost      NUMERIC(12,4) NOT NULL DEFAULT 0,
  compute_cost    NUMERIC(12,4) DEFAULT 0,
  storage_cost    NUMERIC(12,4) DEFAULT 0,
  network_cost    NUMERIC(12,4) DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_cost_recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  recommendation  TEXT NOT NULL CHECK (recommendation IN ('rightsize','terminate','reserve','spot','schedule','consolidate')),
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  current_cost    NUMERIC(12,4) NOT NULL,
  projected_cost  NUMERIC(12,4) NOT NULL,
  savings_pct     NUMERIC(5,2) NOT NULL,
  confidence      NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  applied         BOOLEAN NOT NULL DEFAULT false,
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_budget_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  alert_name      TEXT NOT NULL,
  budget_limit    NUMERIC(12,4) NOT NULL,
  threshold_pct   NUMERIC(5,2) NOT NULL DEFAULT 80,
  current_spend   NUMERIC(12,4) NOT NULL DEFAULT 0,
  alert_status    TEXT NOT NULL CHECK (alert_status IN ('ok','warning','exceeded','acknowledged')) DEFAULT 'ok',
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, alert_name)
);

CREATE INDEX idx_cost_reports_agent ON agent_cost_reports(agent_id);
CREATE INDEX idx_cost_recommendations_agent ON agent_cost_recommendations(agent_id);
CREATE INDEX idx_budget_alerts_agent ON agent_budget_alerts(agent_id);
