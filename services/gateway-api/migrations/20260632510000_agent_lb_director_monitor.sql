-- Migration: agent_lb_director_monitor
CREATE TABLE IF NOT EXISTS agent_lb_director_monitor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lb_director_monitor_agent ON agent_lb_director_monitor_configs(agent_id);
CREATE INDEX idx_agent_lb_director_monitor_enabled ON agent_lb_director_monitor_configs(enabled);
