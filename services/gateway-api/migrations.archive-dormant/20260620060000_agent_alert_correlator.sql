CREATE TABLE IF NOT EXISTS agent_alert_correlator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  correlation_window TEXT NOT NULL DEFAULT '5m',
  dedup_interval TEXT NOT NULL DEFAULT '1h',
  severity_threshold TEXT NOT NULL DEFAULT 'warning',
  notification_channels JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_alert_correlator_configs(id),
  agent_id UUID NOT NULL,
  alert_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'firing',
  correlated_with UUID[],
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_alert_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_alert_id UUID NOT NULL REFERENCES agent_alerts(id),
  correlated_alert_id UUID NOT NULL REFERENCES agent_alerts(id),
  correlation_type TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_agent ON agent_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON agent_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alert_correlations_primary ON agent_alert_correlations(primary_alert_id);
