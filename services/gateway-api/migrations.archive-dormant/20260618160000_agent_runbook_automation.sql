-- Batch 179: Agent Runbook Automation
-- Manages operational runbooks, automated execution steps,
-- approval workflows, and execution history

CREATE TABLE IF NOT EXISTS agent_runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'operations',
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  trigger_conditions JSONB DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  required_approvals INTEGER NOT NULL DEFAULT 0,
  timeout_minutes INTEGER NOT NULL DEFAULT 60,
  rollback_steps JSONB DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID NOT NULL REFERENCES agent_runbooks(id),
  triggered_by UUID,
  trigger_event VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 0,
  step_results JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  error_message TEXT,
  rollback_executed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runbook_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES agent_runbook_executions(id),
  step_index INTEGER NOT NULL,
  approver_agent_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  comments TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runbooks_category ON agent_runbooks(category);
CREATE INDEX idx_runbook_executions_status ON agent_runbook_executions(status);
CREATE INDEX idx_runbook_approvals_status ON agent_runbook_approvals(status);
