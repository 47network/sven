CREATE TABLE IF NOT EXISTS agent_etl_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 3,
  missed_run_policy TEXT NOT NULL DEFAULT 'skip',
  alert_on_failure BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_etl_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_etl_scheduler_configs(id),
  agent_id UUID NOT NULL,
  schedule_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  pipeline_id UUID,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_etl_run_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES agent_etl_schedules(id),
  pipeline_id UUID,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled',
  duration_seconds INTEGER,
  records_processed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_etl_schedules_agent ON agent_etl_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_etl_schedules_status ON agent_etl_schedules(status);
CREATE INDEX IF NOT EXISTS idx_etl_run_history_schedule ON agent_etl_run_history(schedule_id);
