-- Migration: agent_endpoint_mgmt_enrollment
CREATE TABLE IF NOT EXISTS agent_endpoint_mgmt_enrollment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_endpoint_mgmt_enrollment_agent ON agent_endpoint_mgmt_enrollment_configs(agent_id);
CREATE INDEX idx_agent_endpoint_mgmt_enrollment_enabled ON agent_endpoint_mgmt_enrollment_configs(enabled);
