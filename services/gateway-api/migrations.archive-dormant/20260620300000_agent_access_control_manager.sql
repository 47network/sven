-- Batch 393: Access Control Manager
CREATE TABLE IF NOT EXISTS agent_access_control_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_policy TEXT NOT NULL DEFAULT 'deny',
  mfa_required BOOLEAN NOT NULL DEFAULT false,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  max_failed_attempts INTEGER NOT NULL DEFAULT 5,
  ip_whitelist JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_access_control_manager_configs(id),
  name TEXT NOT NULL,
  resource_pattern TEXT NOT NULL,
  actions TEXT[] NOT NULL DEFAULT '{}',
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  conditions JSONB DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_access_control_manager_configs(id),
  principal_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'denied', 'challenged')),
  policy_id UUID REFERENCES agent_access_policies(id),
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_policies_config ON agent_access_policies(config_id);
CREATE INDEX idx_access_logs_config ON agent_access_logs(config_id);
CREATE INDEX idx_access_logs_principal ON agent_access_logs(principal_id);
