-- Migration: agent_blob_archiver
CREATE TABLE IF NOT EXISTS agent_blob_archiver_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_blob_archiver_agent ON agent_blob_archiver_configs(agent_id);
CREATE INDEX idx_agent_blob_archiver_enabled ON agent_blob_archiver_configs(enabled);
