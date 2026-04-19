-- Migration: agent_patch_inventory_loader
CREATE TABLE IF NOT EXISTS agent_patch_inventory_loader_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_patch_inventory_loader_agent ON agent_patch_inventory_loader_configs(agent_id);
CREATE INDEX idx_agent_patch_inventory_loader_enabled ON agent_patch_inventory_loader_configs(enabled);
