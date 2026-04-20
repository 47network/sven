CREATE TABLE IF NOT EXISTS agent_resource_tagger_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  tag_policy_name VARCHAR(500) NOT NULL,
  required_tags JSONB DEFAULT '[]',
  auto_tag_enabled BOOLEAN DEFAULT true,
  compliance_rate NUMERIC(5,2) DEFAULT 0,
  last_audit_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_resource_tagger_configs_agent ON agent_resource_tagger_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_resource_tagger_configs_enabled ON agent_resource_tagger_configs(enabled);
