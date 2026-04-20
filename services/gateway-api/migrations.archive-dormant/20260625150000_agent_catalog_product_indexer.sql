-- Migration: agent_catalog_product_indexer
CREATE TABLE IF NOT EXISTS agent_catalog_product_indexer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_catalog_product_indexer_agent ON agent_catalog_product_indexer_configs(agent_id);
CREATE INDEX idx_agent_catalog_product_indexer_enabled ON agent_catalog_product_indexer_configs(enabled);
