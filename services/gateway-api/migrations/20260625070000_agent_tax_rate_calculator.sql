-- Migration: agent_tax_rate_calculator
CREATE TABLE IF NOT EXISTS agent_tax_rate_calculator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_tax_rate_calculator_agent ON agent_tax_rate_calculator_configs(agent_id);
CREATE INDEX idx_agent_tax_rate_calculator_enabled ON agent_tax_rate_calculator_configs(enabled);
