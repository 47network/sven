-- Migration: agent_dns_zone_synchronizer
CREATE TABLE IF NOT EXISTS agent_dns_zone_synchronizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dns_zone_synchronizer_agent ON agent_dns_zone_synchronizer_configs(agent_id);
CREATE INDEX idx_agent_dns_zone_synchronizer_enabled ON agent_dns_zone_synchronizer_configs(enabled);
