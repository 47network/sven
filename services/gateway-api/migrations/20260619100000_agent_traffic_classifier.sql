-- Batch 273: Traffic Classifier
CREATE TABLE IF NOT EXISTS agent_traffic_class_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  classifier_name VARCHAR(255) NOT NULL,
  interface_name VARCHAR(100) NOT NULL,
  classification_method VARCHAR(50) DEFAULT 'dpi',
  rules JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_traffic_class_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_traffic_class_configs(id),
  flow_id VARCHAR(255) NOT NULL,
  src_ip INET,
  dst_ip INET,
  protocol VARCHAR(50),
  application VARCHAR(100),
  category VARCHAR(100),
  confidence NUMERIC(5,2),
  bytes_transferred BIGINT DEFAULT 0,
  classified_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_traffic_class_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_traffic_class_configs(id),
  policy_name VARCHAR(255) NOT NULL,
  match_criteria JSONB NOT NULL,
  action VARCHAR(50) DEFAULT 'allow',
  priority INTEGER DEFAULT 100,
  hit_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_traffic_class_results_config ON agent_traffic_class_results(config_id);
CREATE INDEX idx_traffic_class_policies_config ON agent_traffic_class_policies(config_id);
