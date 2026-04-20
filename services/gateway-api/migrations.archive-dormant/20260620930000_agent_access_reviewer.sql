CREATE TABLE IF NOT EXISTS agent_access_reviewer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  review_scope VARCHAR(200) NOT NULL,
  review_frequency VARCHAR(50) DEFAULT 'quarterly',
  last_review_at TIMESTAMPTZ,
  findings_count INTEGER DEFAULT 0,
  auto_revoke_enabled BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_access_reviewer_configs_agent ON agent_access_reviewer_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_access_reviewer_configs_enabled ON agent_access_reviewer_configs(enabled);
