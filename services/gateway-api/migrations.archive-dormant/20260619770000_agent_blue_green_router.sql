-- Batch 340: Blue-Green Router
CREATE TABLE IF NOT EXISTS agent_blue_green_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  switch_strategy TEXT DEFAULT 'instant',
  health_check_interval INTEGER DEFAULT 30,
  warmup_seconds INTEGER DEFAULT 60,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_environment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_blue_green_router_configs(id),
  slot_name TEXT NOT NULL,
  slot_color TEXT NOT NULL,
  endpoint_url TEXT,
  is_live BOOLEAN DEFAULT false,
  health_status TEXT DEFAULT 'unknown',
  deployed_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(config_id, slot_name)
);

CREATE TABLE IF NOT EXISTS agent_traffic_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_blue_green_router_configs(id),
  from_slot_id UUID REFERENCES agent_environment_slots(id),
  to_slot_id UUID REFERENCES agent_environment_slots(id),
  status TEXT DEFAULT 'pending',
  switched_at TIMESTAMPTZ,
  rollback_at TIMESTAMPTZ
);

CREATE INDEX idx_env_slots_config ON agent_environment_slots(config_id);
CREATE INDEX idx_traffic_switches_config ON agent_traffic_switches(config_id);
