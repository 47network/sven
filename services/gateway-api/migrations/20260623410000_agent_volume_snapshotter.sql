-- Migration: agent_volume_snapshotter
CREATE TABLE IF NOT EXISTS agent_volume_snapshotter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_volume_snapshotter_agent ON agent_volume_snapshotter_configs(agent_id);
CREATE INDEX idx_agent_volume_snapshotter_enabled ON agent_volume_snapshotter_configs(enabled);
