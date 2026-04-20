-- Migration: agent_image_resize_pipeline
CREATE TABLE IF NOT EXISTS agent_image_resize_pipeline_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_image_resize_pipeline_agent ON agent_image_resize_pipeline_configs(agent_id);
CREATE INDEX idx_agent_image_resize_pipeline_enabled ON agent_image_resize_pipeline_configs(enabled);
