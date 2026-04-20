-- Migration: agent_timezone_syncer
CREATE TABLE IF NOT EXISTS agent_timezone_syncer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_timezone_syncer_agent ON agent_timezone_syncer_configs(agent_id);
CREATE INDEX idx_agent_timezone_syncer_enabled ON agent_timezone_syncer_configs(enabled);
