-- Migration: agent_data_lake_ingestor
CREATE TABLE IF NOT EXISTS agent_data_lake_ingestor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_data_lake_ingestor_agent ON agent_data_lake_ingestor_configs(agent_id);
CREATE INDEX idx_agent_data_lake_ingestor_enabled ON agent_data_lake_ingestor_configs(enabled);
