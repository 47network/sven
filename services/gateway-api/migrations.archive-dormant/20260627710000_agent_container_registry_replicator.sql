-- Migration: agent_container_registry_replicator
CREATE TABLE IF NOT EXISTS agent_container_registry_replicator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_container_registry_replicator_agent ON agent_container_registry_replicator_configs(agent_id);
CREATE INDEX idx_agent_container_registry_replicator_enabled ON agent_container_registry_replicator_configs(enabled);
