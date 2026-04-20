-- Migration: agent_cron_orchestrator
CREATE TABLE IF NOT EXISTS agent_cron_orchestrator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cron_orchestrator_agent ON agent_cron_orchestrator_configs(agent_id);
CREATE INDEX idx_agent_cron_orchestrator_enabled ON agent_cron_orchestrator_configs(enabled);
