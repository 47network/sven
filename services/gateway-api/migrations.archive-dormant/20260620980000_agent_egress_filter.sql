CREATE TABLE IF NOT EXISTS agent_egress_filter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  allowed_destinations JSONB NOT NULL DEFAULT '[]',
  blocked_destinations JSONB NOT NULL DEFAULT '[]',
  protocol_filters JSONB NOT NULL DEFAULT '{}',
  data_loss_prevention JSONB NOT NULL DEFAULT '{}',
  logging_level TEXT NOT NULL DEFAULT 'standard',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_egress_filter_configs_agent ON agent_egress_filter_configs(agent_id);
CREATE INDEX idx_agent_egress_filter_configs_enabled ON agent_egress_filter_configs(enabled);
