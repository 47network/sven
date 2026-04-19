-- Migration: agent_voice_call_dialer
CREATE TABLE IF NOT EXISTS agent_voice_call_dialer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_voice_call_dialer_agent ON agent_voice_call_dialer_configs(agent_id);
CREATE INDEX idx_agent_voice_call_dialer_enabled ON agent_voice_call_dialer_configs(enabled);
