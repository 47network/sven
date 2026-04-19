-- Migration: agent_personalization_segment_resolver
CREATE TABLE IF NOT EXISTS agent_personalization_segment_resolver_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_personalization_segment_resolver_agent ON agent_personalization_segment_resolver_configs(agent_id);
CREATE INDEX idx_agent_personalization_segment_resolver_enabled ON agent_personalization_segment_resolver_configs(enabled);
