-- Migration: agent_media_transcoder
CREATE TABLE IF NOT EXISTS agent_media_transcoder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_media_transcoder_agent ON agent_media_transcoder_configs(agent_id);
CREATE INDEX idx_agent_media_transcoder_enabled ON agent_media_transcoder_configs(enabled);
