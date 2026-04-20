-- Migration: agent_health_probe
CREATE TABLE IF NOT EXISTS agent_health_probe_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_health_probe_agent ON agent_health_probe_configs(agent_id);
CREATE INDEX idx_agent_health_probe_enabled ON agent_health_probe_configs(enabled);
