-- Migration: agent_service_mesh_configurator
CREATE TABLE IF NOT EXISTS agent_service_mesh_configurator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_service_mesh_configurator_agent ON agent_service_mesh_configurator_configs(agent_id);
CREATE INDEX idx_agent_service_mesh_configurator_enabled ON agent_service_mesh_configurator_configs(enabled);
