-- Migration: agent_backup_planner
CREATE TABLE IF NOT EXISTS agent_backup_planner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_backup_planner_agent ON agent_backup_planner_configs(agent_id);
CREATE INDEX idx_agent_backup_planner_enabled ON agent_backup_planner_configs(enabled);
