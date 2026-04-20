-- Migration: agent_retention_scheduler
CREATE TABLE IF NOT EXISTS agent_retention_scheduler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_retention_scheduler_agent ON agent_retention_scheduler_configs(agent_id);
CREATE INDEX idx_agent_retention_scheduler_enabled ON agent_retention_scheduler_configs(enabled);
