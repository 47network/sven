-- Migration: agent_feature_rollout_controller
CREATE TABLE IF NOT EXISTS agent_feature_rollout_controller_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_feature_rollout_controller_agent ON agent_feature_rollout_controller_configs(agent_id);
CREATE INDEX idx_agent_feature_rollout_controller_enabled ON agent_feature_rollout_controller_configs(enabled);
