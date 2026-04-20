CREATE TABLE IF NOT EXISTS agent_cron_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_timezone VARCHAR(100) DEFAULT 'UTC',
  max_active_crons INT DEFAULT 50,
  notification_on_failure BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_cron_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cron_manager_configs(id),
  name VARCHAR(255) NOT NULL,
  expression VARCHAR(100) NOT NULL,
  command TEXT NOT NULL,
  description TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','paused','disabled','error')),
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES agent_cron_entries(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success','failure','timeout','skipped')),
  duration_ms INT,
  output TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cron_manager_agent ON agent_cron_manager_configs(agent_id);
CREATE INDEX idx_cron_entries_config ON agent_cron_entries(config_id);
CREATE INDEX idx_cron_entries_next ON agent_cron_entries(next_trigger_at);
CREATE INDEX idx_cron_logs_entry ON agent_cron_logs(entry_id);
