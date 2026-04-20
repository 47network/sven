-- Migration: agent_feature_switch
CREATE TABLE IF NOT EXISTS agent_feature_switch_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_feature_switch_agent ON agent_feature_switch_configs(agent_id);
CREATE INDEX idx_agent_feature_switch_enabled ON agent_feature_switch_configs(enabled);
