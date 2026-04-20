-- Migration: agent_churn_predictor
CREATE TABLE IF NOT EXISTS agent_churn_predictor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_churn_predictor_agent ON agent_churn_predictor_configs(agent_id);
CREATE INDEX idx_agent_churn_predictor_enabled ON agent_churn_predictor_configs(enabled);
