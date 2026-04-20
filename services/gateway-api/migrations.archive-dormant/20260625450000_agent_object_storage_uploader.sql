-- Migration: agent_object_storage_uploader
CREATE TABLE IF NOT EXISTS agent_object_storage_uploader_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_object_storage_uploader_agent ON agent_object_storage_uploader_configs(agent_id);
CREATE INDEX idx_agent_object_storage_uploader_enabled ON agent_object_storage_uploader_configs(enabled);
