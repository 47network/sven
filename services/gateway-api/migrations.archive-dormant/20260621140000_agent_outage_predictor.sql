CREATE TABLE IF NOT EXISTS agent_outage_predictor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  prediction_window TEXT NOT NULL DEFAULT '24h',
  confidence_threshold NUMERIC NOT NULL DEFAULT 0.7,
  data_sources TEXT[] NOT NULL DEFAULT ARRAY['metrics','logs','events'],
  model_type TEXT NOT NULL DEFAULT 'ensemble',
  retrain_interval TEXT NOT NULL DEFAULT '7d',
  alert_lead_time TEXT NOT NULL DEFAULT '1h',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outage_predictor_agent ON agent_outage_predictor_configs(agent_id);
CREATE INDEX idx_outage_predictor_enabled ON agent_outage_predictor_configs(enabled);
