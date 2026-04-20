-- Migration: agent_pii_scanner
CREATE TABLE IF NOT EXISTS agent_pii_scanner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pii_scanner_agent ON agent_pii_scanner_configs(agent_id);
CREATE INDEX idx_agent_pii_scanner_enabled ON agent_pii_scanner_configs(enabled);
