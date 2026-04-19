CREATE TABLE IF NOT EXISTS agent_ssl_inspector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scan_targets JSONB NOT NULL DEFAULT '[]',
  certificate_policies JSONB NOT NULL DEFAULT '{}',
  expiry_threshold_days INTEGER NOT NULL DEFAULT 30,
  protocol_requirements JSONB NOT NULL DEFAULT '{}',
  alert_channels JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_ssl_inspector_configs_agent ON agent_ssl_inspector_configs(agent_id);
CREATE INDEX idx_agent_ssl_inspector_configs_enabled ON agent_ssl_inspector_configs(enabled);
