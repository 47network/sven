-- Migration: agent_ddos_mitigator
CREATE TABLE IF NOT EXISTS agent_ddos_mitigator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ddos_mitigator_agent ON agent_ddos_mitigator_configs(agent_id);
CREATE INDEX idx_agent_ddos_mitigator_enabled ON agent_ddos_mitigator_configs(enabled);
