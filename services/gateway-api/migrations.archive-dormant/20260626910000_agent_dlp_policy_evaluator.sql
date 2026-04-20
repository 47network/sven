-- Migration: agent_dlp_policy_evaluator
CREATE TABLE IF NOT EXISTS agent_dlp_policy_evaluator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dlp_policy_evaluator_agent ON agent_dlp_policy_evaluator_configs(agent_id);
CREATE INDEX idx_agent_dlp_policy_evaluator_enabled ON agent_dlp_policy_evaluator_configs(enabled);
