-- Migration: agent_pam_session_terminator
CREATE TABLE IF NOT EXISTS agent_pam_session_terminator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pam_session_terminator_agent ON agent_pam_session_terminator_configs(agent_id);
CREATE INDEX idx_agent_pam_session_terminator_enabled ON agent_pam_session_terminator_configs(enabled);
