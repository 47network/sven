-- Batch 277: Port Mapper
CREATE TABLE IF NOT EXISTS agent_port_map_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  mapper_name VARCHAR(255) NOT NULL,
  target_network CIDR NOT NULL,
  scan_method VARCHAR(50) DEFAULT 'syn',
  port_range VARCHAR(100) DEFAULT '1-65535',
  scan_schedule VARCHAR(50) DEFAULT 'weekly',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_port_map_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_port_map_configs(id),
  host_ip INET NOT NULL,
  port INTEGER NOT NULL,
  protocol VARCHAR(10) DEFAULT 'tcp',
  state VARCHAR(20) NOT NULL,
  service_name VARCHAR(100),
  service_version VARCHAR(255),
  banner TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_port_map_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_port_map_configs(id),
  host_ip INET NOT NULL,
  port INTEGER NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  old_state VARCHAR(20),
  new_state VARCHAR(20),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_port_map_results_config ON agent_port_map_results(config_id);
CREATE INDEX idx_port_map_changes_config ON agent_port_map_changes(config_id);
