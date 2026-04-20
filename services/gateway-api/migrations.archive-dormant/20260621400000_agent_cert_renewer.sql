-- Migration: agent_cert_renewer
CREATE TABLE IF NOT EXISTS agent_cert_renewer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cert_renewer_agent ON agent_cert_renewer_configs(agent_id);
CREATE INDEX idx_agent_cert_renewer_enabled ON agent_cert_renewer_configs(enabled);
