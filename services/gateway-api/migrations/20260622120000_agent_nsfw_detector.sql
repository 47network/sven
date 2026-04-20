-- Migration: agent_nsfw_detector
CREATE TABLE IF NOT EXISTS agent_nsfw_detector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_nsfw_detector_agent ON agent_nsfw_detector_configs(agent_id);
CREATE INDEX idx_agent_nsfw_detector_enabled ON agent_nsfw_detector_configs(enabled);
