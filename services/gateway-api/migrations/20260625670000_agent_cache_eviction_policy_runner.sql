-- Migration: agent_cache_eviction_policy_runner
CREATE TABLE IF NOT EXISTS agent_cache_eviction_policy_runner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cache_eviction_policy_runner_agent ON agent_cache_eviction_policy_runner_configs(agent_id);
CREATE INDEX idx_agent_cache_eviction_policy_runner_enabled ON agent_cache_eviction_policy_runner_configs(enabled);
