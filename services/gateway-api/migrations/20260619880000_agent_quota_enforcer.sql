-- Batch 351: Quota Enforcer — resource quota management and enforcement
CREATE TABLE IF NOT EXISTS agent_quota_enforcer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    quota_limit BIGINT NOT NULL,
    quota_period VARCHAR(50) DEFAULT 'monthly',
    enforcement_mode VARCHAR(50) DEFAULT 'soft',
    warning_threshold NUMERIC(5,2) DEFAULT 80.00,
    overage_policy VARCHAR(50) DEFAULT 'throttle',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_quota_enforcer_configs(id),
    current_usage BIGINT DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    peak_usage BIGINT DEFAULT 0,
    last_reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_quota_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_quota_enforcer_configs(id),
    violation_type VARCHAR(50) NOT NULL,
    usage_at_violation BIGINT NOT NULL,
    quota_at_violation BIGINT NOT NULL,
    action_taken VARCHAR(100),
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_quota_enforcer_agent ON agent_quota_enforcer_configs(agent_id);
CREATE INDEX idx_quota_usage_config ON agent_quota_usage(config_id);
CREATE INDEX idx_quota_violations_config ON agent_quota_violations(config_id);
