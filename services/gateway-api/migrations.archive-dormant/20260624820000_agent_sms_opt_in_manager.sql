-- Migration: agent_sms_opt_in_manager
CREATE TABLE IF NOT EXISTS agent_sms_opt_in_manager_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_sms_opt_in_manager_agent ON agent_sms_opt_in_manager_configs(agent_id);
CREATE INDEX idx_agent_sms_opt_in_manager_enabled ON agent_sms_opt_in_manager_configs(enabled);
