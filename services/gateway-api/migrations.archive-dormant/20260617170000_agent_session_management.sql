-- Batch 80: Agent Session Management
-- Tables for managing agent sessions, contexts, handoffs, and conversation state

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  channel TEXT DEFAULT 'api' CHECK (channel IN ('api','web','discord','telegram','slack','email','sms','voice')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','suspended','expired','terminated')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  idle_timeout_ms INTEGER DEFAULT 300000,
  max_duration_ms INTEGER DEFAULT 3600000,
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  context_window_used INTEGER DEFAULT 0,
  parent_session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool','function')),
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  model_used TEXT,
  latency_ms INTEGER,
  tool_calls JSONB,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_contexts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('memory','file','tool_result','summary','injection','rag_result')),
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_handoffs (
  id TEXT PRIMARY KEY,
  from_session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  to_session_id TEXT REFERENCES agent_sessions(id),
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  reason TEXT,
  context_snapshot JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed','failed')),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_analytics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  duration_ms INTEGER,
  total_messages INTEGER DEFAULT 0,
  user_messages INTEGER DEFAULT 0,
  assistant_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  handoff_count INTEGER DEFAULT 0,
  user_satisfaction INTEGER,
  resolution_status TEXT CHECK (resolution_status IN ('resolved','unresolved','escalated','abandoned')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_sessions
CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX idx_agent_sessions_channel ON agent_sessions(channel);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_agent_sessions_last_activity ON agent_sessions(last_activity_at DESC);
CREATE INDEX idx_agent_sessions_created ON agent_sessions(created_at DESC);

-- Indexes for session_messages
CREATE INDEX idx_session_messages_session ON session_messages(session_id);
CREATE INDEX idx_session_messages_role ON session_messages(role);
CREATE INDEX idx_session_messages_created ON session_messages(created_at DESC);

-- Indexes for session_contexts
CREATE INDEX idx_session_contexts_session ON session_contexts(session_id);
CREATE INDEX idx_session_contexts_type ON session_contexts(context_type);
CREATE INDEX idx_session_contexts_priority ON session_contexts(priority DESC);

-- Indexes for session_handoffs
CREATE INDEX idx_session_handoffs_from ON session_handoffs(from_session_id);
CREATE INDEX idx_session_handoffs_to ON session_handoffs(to_session_id);
CREATE INDEX idx_session_handoffs_status ON session_handoffs(status);
CREATE INDEX idx_session_handoffs_from_agent ON session_handoffs(from_agent_id);
CREATE INDEX idx_session_handoffs_to_agent ON session_handoffs(to_agent_id);

-- Indexes for session_analytics
CREATE INDEX idx_session_analytics_session ON session_analytics(session_id);
CREATE INDEX idx_session_analytics_resolution ON session_analytics(resolution_status);
CREATE INDEX idx_session_analytics_created ON session_analytics(created_at DESC);
