-- Migration: agent_column_profiler
CREATE TABLE IF NOT EXISTS agent_column_profiler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_column_profiler_agent ON agent_column_profiler_configs(agent_id);
CREATE INDEX idx_agent_column_profiler_enabled ON agent_column_profiler_configs(enabled);
