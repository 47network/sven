CREATE TABLE IF NOT EXISTS agent_stack_auditor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  audit_scope TEXT[] NOT NULL DEFAULT ARRAY['dependencies','licenses','vulnerabilities'],
  schedule TEXT NOT NULL DEFAULT 'weekly',
  severity_threshold TEXT NOT NULL DEFAULT 'medium',
  auto_fix BOOLEAN NOT NULL DEFAULT false,
  exclusions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stack_auditor_agent ON agent_stack_auditor_configs(agent_id);
CREATE INDEX idx_stack_auditor_enabled ON agent_stack_auditor_configs(enabled);
