-- Migration: agent_lineage_tracer
CREATE TABLE IF NOT EXISTS agent_lineage_tracer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lineage_tracer_agent ON agent_lineage_tracer_configs(agent_id);
CREATE INDEX idx_agent_lineage_tracer_enabled ON agent_lineage_tracer_configs(enabled);
