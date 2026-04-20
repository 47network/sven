-- Migration: agent_collaborative_editor_sync
CREATE TABLE IF NOT EXISTS agent_collaborative_editor_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_collaborative_editor_sync_agent ON agent_collaborative_editor_sync_configs(agent_id);
CREATE INDEX idx_agent_collaborative_editor_sync_enabled ON agent_collaborative_editor_sync_configs(enabled);
