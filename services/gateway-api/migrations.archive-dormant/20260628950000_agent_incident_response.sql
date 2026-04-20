-- Migration: agent_incident_response
CREATE TABLE IF NOT EXISTS agent_incident_response_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_incident_response_agent ON agent_incident_response_configs(agent_id);
CREATE INDEX idx_agent_incident_response_enabled ON agent_incident_response_configs(enabled);
