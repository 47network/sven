-- Migration: agent_rollback_coordinator
CREATE TABLE IF NOT EXISTS agent_rollback_coordinator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_rollback_coordinator_agent ON agent_rollback_coordinator_configs(agent_id);
CREATE INDEX idx_agent_rollback_coordinator_enabled ON agent_rollback_coordinator_configs(enabled);
