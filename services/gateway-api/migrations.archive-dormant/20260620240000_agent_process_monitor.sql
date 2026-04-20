CREATE TABLE IF NOT EXISTS agent_process_monitor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  check_interval_seconds INTEGER NOT NULL DEFAULT 30,
  alert_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 90.00,
  retention_days INTEGER NOT NULL DEFAULT 30,
  auto_restart BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_monitored_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_process_monitor_configs(id),
  agent_id UUID NOT NULL,
  process_name TEXT NOT NULL,
  process_type TEXT NOT NULL DEFAULT 'service',
  pid INTEGER,
  status TEXT NOT NULL DEFAULT 'unknown',
  cpu_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  memory_mb NUMERIC(10,2) NOT NULL DEFAULT 0,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  last_check_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_process_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES agent_monitored_processes(id),
  alert_type TEXT NOT NULL DEFAULT 'warning',
  alert_message TEXT NOT NULL,
  metric_name TEXT,
  metric_value NUMERIC(10,2),
  threshold_value NUMERIC(10,2),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monitored_processes_agent ON agent_monitored_processes(agent_id);
CREATE INDEX IF NOT EXISTS idx_monitored_processes_status ON agent_monitored_processes(status);
CREATE INDEX IF NOT EXISTS idx_process_alerts_process ON agent_process_alerts(process_id);
