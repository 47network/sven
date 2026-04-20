-- Migration: agent_pvc_resizer
CREATE TABLE IF NOT EXISTS agent_pvc_resizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pvc_resizer_agent ON agent_pvc_resizer_configs(agent_id);
CREATE INDEX idx_agent_pvc_resizer_enabled ON agent_pvc_resizer_configs(enabled);
