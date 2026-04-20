-- Migration: agent_chaos_exerciser
CREATE TABLE IF NOT EXISTS agent_chaos_exerciser_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_chaos_exerciser_agent ON agent_chaos_exerciser_configs(agent_id);
CREATE INDEX idx_agent_chaos_exerciser_enabled ON agent_chaos_exerciser_configs(enabled);
