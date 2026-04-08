-- Align workflow_runs.status constraint with the workflow execute route
-- and workflow-executor, both of which rely on an initial pending state.

ALTER TABLE workflow_runs
  DROP CONSTRAINT IF EXISTS workflow_runs_status_check;

ALTER TABLE workflow_runs
  ADD CONSTRAINT workflow_runs_status_check
  CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));
