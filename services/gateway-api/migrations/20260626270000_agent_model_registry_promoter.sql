-- Migration: agent_model_registry_promoter
CREATE TABLE IF NOT EXISTS agent_model_registry_promoter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_model_registry_promoter_agent ON agent_model_registry_promoter_configs(agent_id);
CREATE INDEX idx_agent_model_registry_promoter_enabled ON agent_model_registry_promoter_configs(enabled);
