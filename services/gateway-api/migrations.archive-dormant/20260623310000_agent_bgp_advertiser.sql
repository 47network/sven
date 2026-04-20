-- Migration: agent_bgp_advertiser
CREATE TABLE IF NOT EXISTS agent_bgp_advertiser_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_bgp_advertiser_agent ON agent_bgp_advertiser_configs(agent_id);
CREATE INDEX idx_agent_bgp_advertiser_enabled ON agent_bgp_advertiser_configs(enabled);
