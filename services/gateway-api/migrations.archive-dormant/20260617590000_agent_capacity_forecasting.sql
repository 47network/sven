-- Batch 122 — Capacity Forecasting
-- Predictive capacity planning and resource demand forecasting

CREATE TABLE IF NOT EXISTS agent_capacity_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('cpu','memory','storage','network','gpu','tokens')),
  model_type TEXT NOT NULL DEFAULT 'linear' CHECK (model_type IN ('linear','exponential','seasonal','arima','prophet')),
  training_window_days INT NOT NULL DEFAULT 30,
  forecast_horizon_days INT NOT NULL DEFAULT 90,
  confidence_level NUMERIC(3,2) NOT NULL DEFAULT 0.95,
  last_trained_at TIMESTAMPTZ,
  accuracy_score NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_capacity_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES agent_capacity_models(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_usage NUMERIC NOT NULL,
  lower_bound NUMERIC NOT NULL,
  upper_bound NUMERIC NOT NULL,
  actual_usage NUMERIC,
  unit TEXT NOT NULL DEFAULT 'percent',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, forecast_date)
);

CREATE TABLE IF NOT EXISTS agent_capacity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES agent_capacity_models(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold_breach','trend_warning','anomaly','exhaustion_prediction')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
  threshold_value NUMERIC,
  predicted_breach_date DATE,
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capacity_models_agent ON agent_capacity_models(agent_id);
CREATE INDEX idx_capacity_models_resource ON agent_capacity_models(resource_type);
CREATE INDEX idx_capacity_forecasts_model ON agent_capacity_forecasts(model_id);
CREATE INDEX idx_capacity_forecasts_date ON agent_capacity_forecasts(forecast_date);
CREATE INDEX idx_capacity_alerts_model ON agent_capacity_alerts(model_id);
CREATE INDEX idx_capacity_alerts_type ON agent_capacity_alerts(alert_type);
