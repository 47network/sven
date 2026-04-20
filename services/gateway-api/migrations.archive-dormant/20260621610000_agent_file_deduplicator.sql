-- Migration: agent_file_deduplicator
CREATE TABLE IF NOT EXISTS agent_file_deduplicator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_file_deduplicator_agent ON agent_file_deduplicator_configs(agent_id);
CREATE INDEX idx_agent_file_deduplicator_enabled ON agent_file_deduplicator_configs(enabled);
