-- Migration: agent_db_schema_migrator
CREATE TABLE IF NOT EXISTS agent_db_schema_migrator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_db_schema_migrator_agent ON agent_db_schema_migrator_configs(agent_id);
CREATE INDEX idx_agent_db_schema_migrator_enabled ON agent_db_schema_migrator_configs(enabled);
