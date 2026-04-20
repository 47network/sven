-- Batch 403: Workflow Orchestrator
-- Manages complex multi-step agent workflows with branching, parallel execution, and error recovery

CREATE TABLE IF NOT EXISTS agent_workflow_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_workflows INTEGER NOT NULL DEFAULT 10,
  default_timeout_seconds INTEGER NOT NULL DEFAULT 3600,
  retry_policy JSONB NOT NULL DEFAULT '{"maxRetries": 3, "backoffMs": 1000}',
  error_handling TEXT NOT NULL DEFAULT 'retry' CHECK (error_handling IN ('retry', 'skip', 'abort', 'fallback')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_workflow_orchestrator_configs(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  definition JSONB NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  current_step TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(id),
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('action', 'condition', 'parallel', 'loop', 'wait', 'subprocess')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  retries INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_workflows_config ON agent_workflows(config_id);
CREATE INDEX idx_agent_workflows_status ON agent_workflows(status);
CREATE INDEX idx_agent_workflow_steps_workflow ON agent_workflow_steps(workflow_id);
