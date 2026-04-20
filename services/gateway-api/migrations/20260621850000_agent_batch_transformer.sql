-- Migration: agent_batch_transformer
CREATE TABLE IF NOT EXISTS agent_batch_transformer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_batch_transformer_agent ON agent_batch_transformer_configs(agent_id);
CREATE INDEX idx_agent_batch_transformer_enabled ON agent_batch_transformer_configs(enabled);
