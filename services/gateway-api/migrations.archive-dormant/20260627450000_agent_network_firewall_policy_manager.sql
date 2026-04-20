-- Migration: agent_network_firewall_policy_manager
CREATE TABLE IF NOT EXISTS agent_network_firewall_policy_manager_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_network_firewall_policy_manager_agent ON agent_network_firewall_policy_manager_configs(agent_id);
CREATE INDEX idx_agent_network_firewall_policy_manager_enabled ON agent_network_firewall_policy_manager_configs(enabled);
