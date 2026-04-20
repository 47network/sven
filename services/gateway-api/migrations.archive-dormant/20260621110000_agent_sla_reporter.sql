CREATE TABLE IF NOT EXISTS agent_sla_reporter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sla_definitions JSONB NOT NULL DEFAULT '[]',
  reporting_interval TEXT NOT NULL DEFAULT 'daily',
  breach_threshold NUMERIC NOT NULL DEFAULT 95.0,
  auto_escalate BOOLEAN NOT NULL DEFAULT true,
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sla_reporter_agent ON agent_sla_reporter_configs(agent_id);
CREATE INDEX idx_sla_reporter_enabled ON agent_sla_reporter_configs(enabled);
