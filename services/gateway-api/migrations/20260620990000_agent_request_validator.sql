CREATE TABLE IF NOT EXISTS agent_request_validator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  validation_schemas JSONB NOT NULL DEFAULT '{}',
  sanitization_rules JSONB NOT NULL DEFAULT '[]',
  rate_limiting JSONB NOT NULL DEFAULT '{}',
  content_type_policies JSONB NOT NULL DEFAULT '{}',
  rejection_handling TEXT NOT NULL DEFAULT 'block',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_request_validator_configs_agent ON agent_request_validator_configs(agent_id);
CREATE INDEX idx_agent_request_validator_configs_enabled ON agent_request_validator_configs(enabled);
