-- Migration: agent_long_running_job_supervisor
CREATE TABLE IF NOT EXISTS agent_long_running_job_supervisor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_long_running_job_supervisor_agent ON agent_long_running_job_supervisor_configs(agent_id);
CREATE INDEX idx_agent_long_running_job_supervisor_enabled ON agent_long_running_job_supervisor_configs(enabled);
