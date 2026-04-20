-- Migration: agent_chaos_injector
CREATE TABLE IF NOT EXISTS agent_chaos_injector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_chaos_injector_agent ON agent_chaos_injector_configs(agent_id);
CREATE INDEX idx_agent_chaos_injector_enabled ON agent_chaos_injector_configs(enabled);
