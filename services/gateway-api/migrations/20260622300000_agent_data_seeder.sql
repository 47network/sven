-- Migration: agent_data_seeder
CREATE TABLE IF NOT EXISTS agent_data_seeder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_data_seeder_agent ON agent_data_seeder_configs(agent_id);
CREATE INDEX idx_agent_data_seeder_enabled ON agent_data_seeder_configs(enabled);
