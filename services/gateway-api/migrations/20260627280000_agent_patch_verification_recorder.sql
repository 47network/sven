-- Migration: agent_patch_verification_recorder
CREATE TABLE IF NOT EXISTS agent_patch_verification_recorder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_patch_verification_recorder_agent ON agent_patch_verification_recorder_configs(agent_id);
CREATE INDEX idx_agent_patch_verification_recorder_enabled ON agent_patch_verification_recorder_configs(enabled);
