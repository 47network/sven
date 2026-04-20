-- Batch 215: Bandwidth Controller
-- Agent-managed bandwidth allocation and traffic shaping

CREATE TABLE IF NOT EXISTS agent_bandwidth_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    policy_name VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('service','container','network','interface','tenant','agent','global')),
    target_id VARCHAR(255) NOT NULL,
    max_bandwidth_mbps NUMERIC(10,2),
    guaranteed_bandwidth_mbps NUMERIC(10,2),
    burst_bandwidth_mbps NUMERIC(10,2),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    shaping_algorithm VARCHAR(30) NOT NULL DEFAULT 'htb' CHECK (shaping_algorithm IN ('htb','tbf','sfq','fq_codel','cake','hfsc')),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','enforcing','suspended','expired')),
    schedule JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_bandwidth_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES agent_bandwidth_policies(id) ON DELETE CASCADE,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    inbound_bytes BIGINT NOT NULL DEFAULT 0,
    outbound_bytes BIGINT NOT NULL DEFAULT 0,
    inbound_packets BIGINT NOT NULL DEFAULT 0,
    outbound_packets BIGINT NOT NULL DEFAULT 0,
    avg_bandwidth_mbps NUMERIC(10,2),
    peak_bandwidth_mbps NUMERIC(10,2),
    dropped_packets BIGINT NOT NULL DEFAULT 0,
    throttled_connections INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_bandwidth_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    quota_name VARCHAR(255) NOT NULL,
    quota_type VARCHAR(30) NOT NULL CHECK (quota_type IN ('daily','weekly','monthly','total','burst')),
    limit_bytes BIGINT NOT NULL,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ,
    overage_action VARCHAR(30) NOT NULL DEFAULT 'throttle' CHECK (overage_action IN ('throttle','block','alert','log','upgrade')),
    overage_rate_mbps NUMERIC(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','exceeded','suspended','expired')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bandwidth_policies_agent ON agent_bandwidth_policies(agent_id);
CREATE INDEX idx_bandwidth_policies_target ON agent_bandwidth_policies(target_type, target_id);
CREATE INDEX idx_bandwidth_usage_policy ON agent_bandwidth_usage(policy_id);
CREATE INDEX idx_bandwidth_usage_measured ON agent_bandwidth_usage(measured_at);
CREATE INDEX idx_bandwidth_quotas_agent ON agent_bandwidth_quotas(agent_id);
CREATE INDEX idx_bandwidth_quotas_type ON agent_bandwidth_quotas(quota_type);
