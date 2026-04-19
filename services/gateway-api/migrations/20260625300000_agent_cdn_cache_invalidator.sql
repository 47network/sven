-- Migration: agent_cdn_cache_invalidator
CREATE TABLE IF NOT EXISTS agent_cdn_cache_invalidator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cdn_cache_invalidator_agent ON agent_cdn_cache_invalidator_configs(agent_id);
CREATE INDEX idx_agent_cdn_cache_invalidator_enabled ON agent_cdn_cache_invalidator_configs(enabled);
