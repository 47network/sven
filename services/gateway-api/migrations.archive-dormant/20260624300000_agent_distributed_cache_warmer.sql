-- Migration: agent_distributed_cache_warmer
CREATE TABLE IF NOT EXISTS agent_distributed_cache_warmer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_distributed_cache_warmer_agent ON agent_distributed_cache_warmer_configs(agent_id);
CREATE INDEX idx_agent_distributed_cache_warmer_enabled ON agent_distributed_cache_warmer_configs(enabled);
