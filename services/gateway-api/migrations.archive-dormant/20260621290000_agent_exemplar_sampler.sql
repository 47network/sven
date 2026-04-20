-- Migration: agent_exemplar_sampler
CREATE TABLE IF NOT EXISTS agent_exemplar_sampler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_exemplar_sampler_agent ON agent_exemplar_sampler_configs(agent_id);
CREATE INDEX idx_agent_exemplar_sampler_enabled ON agent_exemplar_sampler_configs(enabled);
