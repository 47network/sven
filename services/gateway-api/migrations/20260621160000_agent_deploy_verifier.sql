CREATE TABLE IF NOT EXISTS agent_deploy_verifier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  verification_checks TEXT[] NOT NULL DEFAULT ARRAY['health','smoke','rollback_ready'],
  timeout_seconds INTEGER NOT NULL DEFAULT 300,
  retry_count INTEGER NOT NULL DEFAULT 3,
  notification_on_failure BOOLEAN NOT NULL DEFAULT true,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_verifier_agent ON agent_deploy_verifier_configs(agent_id);
CREATE INDEX idx_deploy_verifier_enabled ON agent_deploy_verifier_configs(enabled);
