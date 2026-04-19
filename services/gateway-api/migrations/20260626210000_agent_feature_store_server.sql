-- Migration: agent_feature_store_server
CREATE TABLE IF NOT EXISTS agent_feature_store_server_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_feature_store_server_agent ON agent_feature_store_server_configs(agent_id);
CREATE INDEX idx_agent_feature_store_server_enabled ON agent_feature_store_server_configs(enabled);
