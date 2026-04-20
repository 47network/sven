-- Migration: agent_license_checker
CREATE TABLE IF NOT EXISTS agent_license_checker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_license_checker_agent ON agent_license_checker_configs(agent_id);
CREATE INDEX idx_agent_license_checker_enabled ON agent_license_checker_configs(enabled);
