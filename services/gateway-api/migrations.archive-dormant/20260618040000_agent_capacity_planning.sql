-- Batch 167: Agent Capacity Planning
-- Forecast resource needs, plan scaling, track utilization trends

CREATE TABLE IF NOT EXISTS agent_capacity_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  model_name      TEXT NOT NULL,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('compute','memory','storage','gpu','network','agents','tasks')),
  forecast_method TEXT NOT NULL DEFAULT 'linear' CHECK (forecast_method IN ('linear','exponential','seasonal','ml_based','manual')),
  current_usage   NUMERIC(18,6) NOT NULL DEFAULT 0,
  max_capacity    NUMERIC(18,6) NOT NULL,
  threshold_pct   NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  growth_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_capacity_forecasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        UUID NOT NULL REFERENCES agent_capacity_models(id),
  forecast_date   DATE NOT NULL,
  predicted_usage NUMERIC(18,6) NOT NULL,
  confidence_low  NUMERIC(18,6),
  confidence_high NUMERIC(18,6),
  confidence_pct  NUMERIC(5,2) NOT NULL DEFAULT 80,
  breach_expected BOOLEAN NOT NULL DEFAULT false,
  action_needed   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_capacity_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        UUID NOT NULL REFERENCES agent_capacity_models(id),
  action_type     TEXT NOT NULL CHECK (action_type IN ('scale_up','scale_down','provision','decommission','migrate','optimize','alert')),
  description     TEXT NOT NULL,
  estimated_cost  NUMERIC(18,6),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','in_progress','completed','rejected')),
  approved_by     TEXT,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capacity_models_tenant ON agent_capacity_models(tenant_id);
CREATE INDEX idx_capacity_forecasts_model ON agent_capacity_forecasts(model_id);
CREATE INDEX idx_capacity_actions_model ON agent_capacity_actions(model_id);
