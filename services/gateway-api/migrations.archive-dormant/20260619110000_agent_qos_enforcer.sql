-- Batch 274: QoS Enforcer
CREATE TABLE IF NOT EXISTS agent_qos_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  enforcer_name VARCHAR(255) NOT NULL,
  interface_name VARCHAR(100) NOT NULL,
  scheduling_algo VARCHAR(50) DEFAULT 'wrr',
  total_bandwidth BIGINT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_qos_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_qos_configs(id),
  class_name VARCHAR(100) NOT NULL,
  priority INTEGER DEFAULT 5,
  min_bandwidth BIGINT,
  max_bandwidth BIGINT,
  burst_size BIGINT,
  dscp_marking VARCHAR(10),
  packet_count BIGINT DEFAULT 0,
  byte_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_qos_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES agent_qos_classes(id),
  violation_type VARCHAR(50) NOT NULL,
  details JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_qos_classes_config ON agent_qos_classes(config_id);
CREATE INDEX idx_qos_violations_class ON agent_qos_violations(class_id);
