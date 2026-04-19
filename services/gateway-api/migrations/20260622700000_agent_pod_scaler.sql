-- Migration: agent_pod_scaler
CREATE TABLE IF NOT EXISTS agent_pod_scaler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pod_scaler_agent ON agent_pod_scaler_configs(agent_id);
CREATE INDEX idx_agent_pod_scaler_enabled ON agent_pod_scaler_configs(enabled);
