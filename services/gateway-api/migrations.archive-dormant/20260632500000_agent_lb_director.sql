-- Migration: agent_lb_director
CREATE TABLE IF NOT EXISTS agent_lb_director_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lb_director_agent ON agent_lb_director_configs(agent_id);
CREATE INDEX idx_agent_lb_director_enabled ON agent_lb_director_configs(enabled);
