-- Migration: agent_stream_replayer
CREATE TABLE IF NOT EXISTS agent_stream_replayer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_stream_replayer_agent ON agent_stream_replayer_configs(agent_id);
CREATE INDEX idx_agent_stream_replayer_enabled ON agent_stream_replayer_configs(enabled);
