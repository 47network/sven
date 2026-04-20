-- Batch 439: Blue-Green Switcher
CREATE TABLE IF NOT EXISTS agent_blue_green_switcher_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  switch_timeout_ms INTEGER NOT NULL DEFAULT 60000,
  health_check_retries INTEGER NOT NULL DEFAULT 3,
  auto_rollback BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_bg_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_blue_green_switcher_configs(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('blue','green')),
  endpoint TEXT NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT false,
  version TEXT,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','unhealthy','unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_bg_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_blue_green_switcher_configs(id),
  from_color TEXT NOT NULL,
  to_color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','switching','completed','rolled_back','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_agent_blue_green_switcher_configs_agent ON agent_blue_green_switcher_configs(agent_id);
CREATE INDEX idx_agent_bg_environments_config ON agent_bg_environments(config_id);
CREATE INDEX idx_agent_bg_switches_config ON agent_bg_switches(config_id);
