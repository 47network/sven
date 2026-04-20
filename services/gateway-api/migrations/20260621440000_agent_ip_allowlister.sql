-- Migration: agent_ip_allowlister
CREATE TABLE IF NOT EXISTS agent_ip_allowlister_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ip_allowlister_agent ON agent_ip_allowlister_configs(agent_id);
CREATE INDEX idx_agent_ip_allowlister_enabled ON agent_ip_allowlister_configs(enabled);
