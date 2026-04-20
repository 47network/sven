-- Batch 173: Agent Cost Anomaly Detection
-- Monitors infrastructure and service costs, detects anomalies,
-- forecasts spending, and generates optimization recommendations

CREATE TABLE IF NOT EXISTS agent_cost_anomaly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  budget_name TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('compute','storage','network','database','api_calls','gpu','bandwidth','licensing')),
  monthly_limit_tokens NUMERIC(18,6) NOT NULL DEFAULT 0,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  current_spend NUMERIC(18,6) NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_cost_anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES agent_cost_anomaly_budgets(id),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('spike','trend','forecast_breach','budget_exceeded','unusual_pattern','cost_drift')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical','emergency')),
  detected_value NUMERIC(18,6) NOT NULL,
  expected_value NUMERIC(18,6) NOT NULL,
  deviation_pct NUMERIC(8,2) NOT NULL,
  root_cause TEXT,
  recommendation TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_cost_anomaly_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES agent_cost_anomaly_budgets(id),
  forecast_period TEXT NOT NULL CHECK (forecast_period IN ('daily','weekly','monthly','quarterly')),
  predicted_spend NUMERIC(18,6) NOT NULL,
  confidence_lower NUMERIC(18,6) NOT NULL,
  confidence_upper NUMERIC(18,6) NOT NULL,
  model_type TEXT NOT NULL DEFAULT 'linear_regression',
  accuracy_score NUMERIC(5,4),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_cost_budgets_agent ON agent_cost_anomaly_budgets(agent_id);
CREATE INDEX idx_cost_detections_budget ON agent_cost_anomaly_detections(budget_id);
CREATE INDEX idx_cost_detections_severity ON agent_cost_anomaly_detections(severity);
CREATE INDEX idx_cost_forecasts_budget ON agent_cost_anomaly_forecasts(budget_id);
