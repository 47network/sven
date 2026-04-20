-- Migration: agent_env_allocator_monitor
CREATE TABLE IF NOT EXISTS agent_env_allocator_monitor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_env_allocator_monitor_agent ON agent_env_allocator_monitor_configs(agent_id);
CREATE INDEX idx_agent_env_allocator_monitor_enabled ON agent_env_allocator_monitor_configs(enabled);
