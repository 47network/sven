-- Migration: agent_workflow_state_machine
CREATE TABLE IF NOT EXISTS agent_workflow_state_machine_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_workflow_state_machine_agent ON agent_workflow_state_machine_configs(agent_id);
CREATE INDEX idx_agent_workflow_state_machine_enabled ON agent_workflow_state_machine_configs(enabled);
