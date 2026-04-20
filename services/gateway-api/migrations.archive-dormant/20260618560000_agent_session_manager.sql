-- Batch 219: Session Manager
-- Agent-managed user/API session lifecycle

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'user' CHECK (session_type IN ('user','api','service','websocket','streaming')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','suspended','expired','terminated')),
  client_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  token_hash TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('created','refreshed','suspended','resumed','expired','terminated','activity')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_session_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  max_sessions INTEGER DEFAULT 100,
  idle_timeout_seconds INTEGER DEFAULT 1800,
  max_lifetime_seconds INTEGER DEFAULT 86400,
  concurrent_limit INTEGER DEFAULT 10,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX idx_sessions_status ON agent_sessions(status);
CREATE INDEX idx_sessions_type ON agent_sessions(session_type);
CREATE INDEX idx_session_events_session ON agent_session_events(session_id);
CREATE INDEX idx_session_policies_agent ON agent_session_policies(agent_id);
