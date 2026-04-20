-- Migration: agent_network_policy_reporter
CREATE TABLE IF NOT EXISTS agent_network_policy_reporter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_network_policy_reporter_agent ON agent_network_policy_reporter_configs(agent_id);
CREATE INDEX idx_agent_network_policy_reporter_enabled ON agent_network_policy_reporter_configs(enabled);
