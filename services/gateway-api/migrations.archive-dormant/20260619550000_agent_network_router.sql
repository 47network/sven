CREATE TABLE IF NOT EXISTS agent_network_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  router_name TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  routing_algorithm TEXT NOT NULL DEFAULT 'round_robin',
  max_routes INTEGER DEFAULT 1000,
  health_check_interval INTEGER DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_network_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_network_router_configs(id),
  destination TEXT NOT NULL,
  gateway TEXT,
  metric INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  traffic_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_network_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_network_router_configs(id),
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'allow',
  source_cidr TEXT,
  dest_cidr TEXT,
  priority INTEGER DEFAULT 100,
  action TEXT NOT NULL DEFAULT 'forward',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_net_routes_config ON agent_network_routes(config_id);
CREATE INDEX idx_net_policies_config ON agent_network_policies(config_id);
