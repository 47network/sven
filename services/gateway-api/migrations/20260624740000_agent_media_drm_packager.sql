-- Migration: agent_media_drm_packager
CREATE TABLE IF NOT EXISTS agent_media_drm_packager_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_media_drm_packager_agent ON agent_media_drm_packager_configs(agent_id);
CREATE INDEX idx_agent_media_drm_packager_enabled ON agent_media_drm_packager_configs(enabled);
