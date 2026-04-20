-- Migration: agent_lake_export_packager
CREATE TABLE IF NOT EXISTS agent_lake_export_packager_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lake_export_packager_agent ON agent_lake_export_packager_configs(agent_id);
CREATE INDEX idx_agent_lake_export_packager_enabled ON agent_lake_export_packager_configs(enabled);
