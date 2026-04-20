-- Batch 236: Session Enforcer
-- Enforces session policies, limits, and security rules

CREATE TABLE IF NOT EXISTS agent_session_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 10,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  idle_timeout_minutes INTEGER NOT NULL DEFAULT 15,
  ip_whitelist JSONB DEFAULT '[]',
  require_mfa BOOLEAN NOT NULL DEFAULT false,
  geo_restrictions JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES agent_session_policies(id),
  agent_id UUID NOT NULL,
  session_token_hash VARCHAR(128) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'expired', 'terminated'))
);

CREATE TABLE IF NOT EXISTS agent_session_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_active_sessions(id),
  agent_id UUID NOT NULL,
  violation_type VARCHAR(64) NOT NULL CHECK (violation_type IN ('concurrent_limit', 'timeout', 'ip_violation', 'geo_violation', 'mfa_required', 'suspicious_activity')),
  details JSONB DEFAULT '{}',
  action_taken VARCHAR(64) NOT NULL CHECK (action_taken IN ('warned', 'session_terminated', 'account_locked', 'alert_sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_policies_agent ON agent_session_policies(agent_id);
CREATE INDEX idx_active_sessions_agent ON agent_active_sessions(agent_id);
CREATE INDEX idx_active_sessions_status ON agent_active_sessions(status);
CREATE INDEX idx_session_violations_session ON agent_session_violations(session_id);
CREATE INDEX idx_session_violations_agent ON agent_session_violations(agent_id);
