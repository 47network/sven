-- Batch 178: Agent Quota Enforcement
-- Manages resource quotas, usage tracking, enforcement policies,
-- and overage handling across the agent ecosystem

CREATE TABLE IF NOT EXISTS agent_quota_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  resource_type VARCHAR(100) NOT NULL,
  scope VARCHAR(50) NOT NULL DEFAULT 'agent',
  limit_value BIGINT NOT NULL,
  limit_unit VARCHAR(50) NOT NULL DEFAULT 'count',
  period VARCHAR(50) NOT NULL DEFAULT 'monthly',
  enforcement_action VARCHAR(50) NOT NULL DEFAULT 'soft_limit',
  overage_rate NUMERIC(12,4) DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_quota_policies(id),
  agent_id UUID NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  current_usage BIGINT NOT NULL DEFAULT 0,
  peak_usage BIGINT NOT NULL DEFAULT 0,
  overage_amount BIGINT NOT NULL DEFAULT 0,
  overage_cost NUMERIC(12,4) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'within_limit',
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_quota_policies(id),
  agent_id UUID NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  threshold_percent INTEGER NOT NULL,
  current_percent INTEGER NOT NULL,
  message TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quota_policies_resource ON agent_quota_policies(resource_type);
CREATE INDEX idx_quota_usage_agent ON agent_quota_usage(agent_id, period_start);
CREATE INDEX idx_quota_alerts_agent ON agent_quota_alerts(agent_id, acknowledged);
