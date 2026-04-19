-- Migration: agent_db_failover_arbiter
CREATE TABLE IF NOT EXISTS agent_db_failover_arbiter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_db_failover_arbiter_agent ON agent_db_failover_arbiter_configs(agent_id);
CREATE INDEX idx_agent_db_failover_arbiter_enabled ON agent_db_failover_arbiter_configs(enabled);
