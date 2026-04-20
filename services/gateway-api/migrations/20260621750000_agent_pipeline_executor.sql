-- Migration: agent_pipeline_executor
CREATE TABLE IF NOT EXISTS agent_pipeline_executor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pipeline_executor_agent ON agent_pipeline_executor_configs(agent_id);
CREATE INDEX idx_agent_pipeline_executor_enabled ON agent_pipeline_executor_configs(enabled);
