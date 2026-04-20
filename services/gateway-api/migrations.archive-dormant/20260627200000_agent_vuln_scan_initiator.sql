-- Migration: agent_vuln_scan_initiator
CREATE TABLE IF NOT EXISTS agent_vuln_scan_initiator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_vuln_scan_initiator_agent ON agent_vuln_scan_initiator_configs(agent_id);
CREATE INDEX idx_agent_vuln_scan_initiator_enabled ON agent_vuln_scan_initiator_configs(enabled);
