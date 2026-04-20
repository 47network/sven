-- Batch 228: Policy Engine
-- Manages security and governance policies for agent operations

CREATE TABLE IF NOT EXISTS agent_security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_type VARCHAR(64) NOT NULL CHECK (policy_type IN ('access', 'data', 'network', 'compliance', 'operational')),
  rules JSONB NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 100,
  enforcement VARCHAR(32) NOT NULL DEFAULT 'enforce' CHECK (enforcement IN ('enforce', 'audit', 'disabled')),
  scope JSONB DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_policy_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_security_policies(id),
  agent_id UUID NOT NULL,
  action VARCHAR(255) NOT NULL,
  decision VARCHAR(32) NOT NULL CHECK (decision IN ('allow', 'deny', 'audit')),
  context JSONB DEFAULT '{}',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_policy_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_security_policies(id),
  agent_id UUID NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID,
  expires_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_policies_agent ON agent_security_policies(agent_id);
CREATE INDEX idx_security_policies_type ON agent_security_policies(policy_type);
CREATE INDEX idx_policy_evaluations_policy ON agent_policy_evaluations(policy_id);
CREATE INDEX idx_policy_evaluations_agent ON agent_policy_evaluations(agent_id);
CREATE INDEX idx_policy_exceptions_policy ON agent_policy_exceptions(policy_id);
