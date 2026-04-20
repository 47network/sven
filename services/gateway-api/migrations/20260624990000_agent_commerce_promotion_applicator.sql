-- Migration: agent_commerce_promotion_applicator
CREATE TABLE IF NOT EXISTS agent_commerce_promotion_applicator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_commerce_promotion_applicator_agent ON agent_commerce_promotion_applicator_configs(agent_id);
CREATE INDEX idx_agent_commerce_promotion_applicator_enabled ON agent_commerce_promotion_applicator_configs(enabled);
