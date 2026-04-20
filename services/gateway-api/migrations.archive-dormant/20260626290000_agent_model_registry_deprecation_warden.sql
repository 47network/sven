-- Migration: agent_model_registry_deprecation_warden
CREATE TABLE IF NOT EXISTS agent_model_registry_deprecation_warden_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_model_registry_deprecation_warden_agent ON agent_model_registry_deprecation_warden_configs(agent_id);
CREATE INDEX idx_agent_model_registry_deprecation_warden_enabled ON agent_model_registry_deprecation_warden_configs(enabled);
