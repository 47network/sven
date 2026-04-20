-- Migration: agent_sms_sender
CREATE TABLE IF NOT EXISTS agent_sms_sender_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_sms_sender_agent ON agent_sms_sender_configs(agent_id);
CREATE INDEX idx_agent_sms_sender_enabled ON agent_sms_sender_configs(enabled);
