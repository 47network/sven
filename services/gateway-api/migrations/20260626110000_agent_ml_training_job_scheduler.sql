-- Migration: agent_ml_training_job_scheduler
CREATE TABLE IF NOT EXISTS agent_ml_training_job_scheduler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ml_training_job_scheduler_agent ON agent_ml_training_job_scheduler_configs(agent_id);
CREATE INDEX idx_agent_ml_training_job_scheduler_enabled ON agent_ml_training_job_scheduler_configs(enabled);
