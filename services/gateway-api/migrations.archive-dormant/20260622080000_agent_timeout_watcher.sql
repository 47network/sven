-- Migration: agent_timeout_watcher
CREATE TABLE IF NOT EXISTS agent_timeout_watcher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_timeout_watcher_agent ON agent_timeout_watcher_configs(agent_id);
CREATE INDEX idx_agent_timeout_watcher_enabled ON agent_timeout_watcher_configs(enabled);
