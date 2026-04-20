-- Migration: agent_catalog_crawler
CREATE TABLE IF NOT EXISTS agent_catalog_crawler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_catalog_crawler_agent ON agent_catalog_crawler_configs(agent_id);
CREATE INDEX idx_agent_catalog_crawler_enabled ON agent_catalog_crawler_configs(enabled);
