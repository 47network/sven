-- Migration: agent_edge_security_responder
CREATE TABLE IF NOT EXISTS agent_edge_security_responder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_edge_security_responder_agent ON agent_edge_security_responder_configs(agent_id);
CREATE INDEX idx_agent_edge_security_responder_enabled ON agent_edge_security_responder_configs(enabled);
