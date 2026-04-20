-- Migration: agent_dlp_content_classifier
CREATE TABLE IF NOT EXISTS agent_dlp_content_classifier_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dlp_content_classifier_agent ON agent_dlp_content_classifier_configs(agent_id);
CREATE INDEX idx_agent_dlp_content_classifier_enabled ON agent_dlp_content_classifier_configs(enabled);
