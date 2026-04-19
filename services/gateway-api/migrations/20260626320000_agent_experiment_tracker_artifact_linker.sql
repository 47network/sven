-- Migration: agent_experiment_tracker_artifact_linker
CREATE TABLE IF NOT EXISTS agent_experiment_tracker_artifact_linker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_experiment_tracker_artifact_linker_agent ON agent_experiment_tracker_artifact_linker_configs(agent_id);
CREATE INDEX idx_agent_experiment_tracker_artifact_linker_enabled ON agent_experiment_tracker_artifact_linker_configs(enabled);
