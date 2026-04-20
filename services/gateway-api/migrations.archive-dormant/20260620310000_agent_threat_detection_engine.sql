-- Batch 394: Threat Detection Engine
CREATE TABLE IF NOT EXISTS agent_threat_detection_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  sensitivity_level TEXT NOT NULL DEFAULT 'medium' CHECK (sensitivity_level IN ('low', 'medium', 'high', 'critical')),
  auto_block BOOLEAN NOT NULL DEFAULT false,
  alert_channels JSONB DEFAULT '[]'::jsonb,
  scan_interval_seconds INTEGER NOT NULL DEFAULT 300,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_threat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_threat_detection_engine_configs(id),
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  response_action TEXT NOT NULL DEFAULT 'alert' CHECK (response_action IN ('alert', 'block', 'quarantine', 'log')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_threat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_threat_detection_engine_configs(id),
  rule_id UUID REFERENCES agent_threat_rules(id),
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_threat_rules_config ON agent_threat_rules(config_id);
CREATE INDEX idx_threat_events_config ON agent_threat_events(config_id);
CREATE INDEX idx_threat_events_severity ON agent_threat_events(severity);
