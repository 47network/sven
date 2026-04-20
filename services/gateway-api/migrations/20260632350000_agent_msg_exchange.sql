-- Migration: agent_msg_exchange
CREATE TABLE IF NOT EXISTS agent_msg_exchange_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_msg_exchange_agent ON agent_msg_exchange_configs(agent_id);
CREATE INDEX idx_agent_msg_exchange_enabled ON agent_msg_exchange_configs(enabled);
