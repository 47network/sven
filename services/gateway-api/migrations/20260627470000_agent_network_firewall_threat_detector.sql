-- Migration: agent_network_firewall_threat_detector
CREATE TABLE IF NOT EXISTS agent_network_firewall_threat_detector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_network_firewall_threat_detector_agent ON agent_network_firewall_threat_detector_configs(agent_id);
CREATE INDEX idx_agent_network_firewall_threat_detector_enabled ON agent_network_firewall_threat_detector_configs(enabled);
