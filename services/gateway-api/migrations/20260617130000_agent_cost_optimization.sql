-- Batch 76: Agent Cost Optimization
-- Track, analyze and optimize costs across the agent ecosystem

CREATE TABLE IF NOT EXISTS cost_budgets (
  id             TEXT PRIMARY KEY,
  budget_name    TEXT NOT NULL,
  owner_agent_id TEXT,
  period         TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly','quarterly','annual')),
  amount_tokens  NUMERIC(18,4) NOT NULL DEFAULT 0,
  spent_tokens   NUMERIC(18,4) NOT NULL DEFAULT 0,
  alert_threshold NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','exhausted','archived')),
  metadata       JSONB NOT NULL DEFAULT '{}',
  starts_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id            TEXT PRIMARY KEY,
  budget_id     TEXT REFERENCES cost_budgets(id),
  agent_id      TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('compute','storage','network','llm_tokens','api_call','bandwidth','memory')),
  amount_tokens NUMERIC(18,4) NOT NULL,
  description   TEXT,
  task_id       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_forecasts (
  id              TEXT PRIMARY KEY,
  budget_id       TEXT REFERENCES cost_budgets(id),
  forecast_period TEXT NOT NULL CHECK (forecast_period IN ('next_day','next_week','next_month','next_quarter')),
  predicted_spend NUMERIC(18,4) NOT NULL,
  confidence      NUMERIC(5,2) NOT NULL DEFAULT 0.80,
  model_used      TEXT NOT NULL DEFAULT 'linear',
  factors         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_recommendations (
  id                TEXT PRIMARY KEY,
  budget_id         TEXT REFERENCES cost_budgets(id),
  category          TEXT NOT NULL CHECK (category IN ('downsize','eliminate','schedule','batch','cache','substitute')),
  title             TEXT NOT NULL,
  description       TEXT,
  estimated_savings NUMERIC(18,4) NOT NULL DEFAULT 0,
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','implemented')),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_alerts (
  id          TEXT PRIMARY KEY,
  budget_id   TEXT REFERENCES cost_budgets(id),
  alert_type  TEXT NOT NULL CHECK (alert_type IN ('threshold','spike','anomaly','forecast_overrun','budget_exhausted')),
  severity    TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message     TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB NOT NULL DEFAULT '{}',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_budgets_owner ON cost_budgets(owner_agent_id);
CREATE INDEX idx_cost_budgets_status ON cost_budgets(status);
CREATE INDEX idx_cost_budgets_period ON cost_budgets(period);
CREATE INDEX idx_cost_budgets_starts ON cost_budgets(starts_at);
CREATE INDEX idx_cost_entries_budget ON cost_entries(budget_id);
CREATE INDEX idx_cost_entries_agent ON cost_entries(agent_id);
CREATE INDEX idx_cost_entries_resource ON cost_entries(resource_type);
CREATE INDEX idx_cost_entries_task ON cost_entries(task_id);
CREATE INDEX idx_cost_entries_recorded ON cost_entries(recorded_at);
CREATE INDEX idx_cost_entries_created ON cost_entries(created_at);
CREATE INDEX idx_cost_forecasts_budget ON cost_forecasts(budget_id);
CREATE INDEX idx_cost_forecasts_period ON cost_forecasts(forecast_period);
CREATE INDEX idx_cost_forecasts_created ON cost_forecasts(created_at);
CREATE INDEX idx_cost_recs_budget ON cost_recommendations(budget_id);
CREATE INDEX idx_cost_recs_category ON cost_recommendations(category);
CREATE INDEX idx_cost_recs_priority ON cost_recommendations(priority);
CREATE INDEX idx_cost_recs_status ON cost_recommendations(status);
CREATE INDEX idx_cost_alerts_budget ON cost_alerts(budget_id);
CREATE INDEX idx_cost_alerts_type ON cost_alerts(alert_type);
CREATE INDEX idx_cost_alerts_severity ON cost_alerts(severity);
