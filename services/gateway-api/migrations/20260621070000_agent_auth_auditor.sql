CREATE TABLE IF NOT EXISTS agent_auth_auditor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  audit_scope JSONB NOT NULL DEFAULT '[]',
  compliance_standards JSONB NOT NULL DEFAULT '[]',
  audit_frequency TEXT NOT NULL DEFAULT 'weekly',
  report_format TEXT NOT NULL DEFAULT 'json',
  alert_on_anomaly BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_auth_auditor_configs_agent ON agent_auth_auditor_configs(agent_id);
CREATE INDEX idx_agent_auth_auditor_configs_enabled ON agent_auth_auditor_configs(enabled);
