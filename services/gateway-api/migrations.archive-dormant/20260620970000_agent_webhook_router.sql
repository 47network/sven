CREATE TABLE IF NOT EXISTS agent_webhook_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  endpoints JSONB NOT NULL DEFAULT '[]',
  routing_rules JSONB NOT NULL DEFAULT '[]',
  retry_policy JSONB NOT NULL DEFAULT '{}',
  signature_verification JSONB NOT NULL DEFAULT '{}',
  delivery_log_retention_days INTEGER NOT NULL DEFAULT 30,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_webhook_router_configs_agent ON agent_webhook_router_configs(agent_id);
CREATE INDEX idx_agent_webhook_router_configs_enabled ON agent_webhook_router_configs(enabled);
