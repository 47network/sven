-- Migration: agent_seo_canonical_resolver
CREATE TABLE IF NOT EXISTS agent_seo_canonical_resolver_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_seo_canonical_resolver_agent ON agent_seo_canonical_resolver_configs(agent_id);
CREATE INDEX idx_agent_seo_canonical_resolver_enabled ON agent_seo_canonical_resolver_configs(enabled);
