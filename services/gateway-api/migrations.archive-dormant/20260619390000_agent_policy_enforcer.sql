-- Batch 302: Policy Enforcer
CREATE TABLE IF NOT EXISTS agent_policy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  policy_engine TEXT NOT NULL DEFAULT 'opa', enforcement_mode TEXT NOT NULL DEFAULT 'enforce',
  audit_log BOOLEAN DEFAULT true, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_policy_configs(id),
  policy_name TEXT NOT NULL, policy_type TEXT NOT NULL DEFAULT 'resource',
  rules JSONB NOT NULL DEFAULT '[]', priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_policy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), policy_id UUID NOT NULL REFERENCES agent_policies(id),
  action TEXT NOT NULL, resource TEXT NOT NULL, principal TEXT NOT NULL,
  allowed BOOLEAN NOT NULL, reason TEXT, evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_policy_configs_agent ON agent_policy_configs(agent_id);
CREATE INDEX idx_policies_config ON agent_policies(config_id);
CREATE INDEX idx_policy_decisions_policy ON agent_policy_decisions(policy_id);
