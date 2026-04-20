-- Migration: agent_doc_generator_optimizer
CREATE TABLE IF NOT EXISTS agent_doc_generator_optimizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_doc_generator_optimizer_agent ON agent_doc_generator_optimizer_configs(agent_id);
CREATE INDEX idx_agent_doc_generator_optimizer_enabled ON agent_doc_generator_optimizer_configs(enabled);
