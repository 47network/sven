CREATE TABLE IF NOT EXISTS agent_proxy_configurator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  proxy_type TEXT NOT NULL DEFAULT 'reverse',
  upstream_targets JSONB NOT NULL DEFAULT '[]',
  routing_rules JSONB NOT NULL DEFAULT '[]',
  caching_policy JSONB NOT NULL DEFAULT '{}',
  rate_limits JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_proxy_configurator_configs_agent ON agent_proxy_configurator_configs(agent_id);
CREATE INDEX idx_agent_proxy_configurator_configs_enabled ON agent_proxy_configurator_configs(enabled);
