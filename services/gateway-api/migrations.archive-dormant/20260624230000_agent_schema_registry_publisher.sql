-- Migration: agent_schema_registry_publisher
CREATE TABLE IF NOT EXISTS agent_schema_registry_publisher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_schema_registry_publisher_agent ON agent_schema_registry_publisher_configs(agent_id);
CREATE INDEX idx_agent_schema_registry_publisher_enabled ON agent_schema_registry_publisher_configs(enabled);
