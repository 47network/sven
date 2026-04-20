CREATE TABLE IF NOT EXISTS agent_anomaly_detector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  detection_model TEXT NOT NULL DEFAULT 'statistical',
  sensitivity NUMERIC NOT NULL DEFAULT 0.8,
  baseline_window TEXT NOT NULL DEFAULT '7d',
  alert_threshold NUMERIC NOT NULL DEFAULT 3.0,
  metric_patterns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anomaly_detector_agent ON agent_anomaly_detector_configs(agent_id);
CREATE INDEX idx_anomaly_detector_enabled ON agent_anomaly_detector_configs(enabled);
