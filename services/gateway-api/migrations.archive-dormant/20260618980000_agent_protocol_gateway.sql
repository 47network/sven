-- Batch 261: Protocol Gateway
CREATE TABLE IF NOT EXISTS agent_proto_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  gateway_name VARCHAR(255) NOT NULL,
  source_protocol VARCHAR(50) NOT NULL,
  target_protocol VARCHAR(50) NOT NULL,
  listen_address VARCHAR(255) NOT NULL,
  forward_address VARCHAR(255) NOT NULL,
  transform_rules JSONB DEFAULT '[]',
  buffer_size_kb INTEGER DEFAULT 64,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proto_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES agent_proto_gateways(id),
  mapping_name VARCHAR(255) NOT NULL,
  source_field VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  transform_type VARCHAR(50) DEFAULT 'direct',
  transform_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proto_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES agent_proto_gateways(id),
  period_start TIMESTAMPTZ NOT NULL,
  messages_translated BIGINT DEFAULT 0,
  translation_errors BIGINT DEFAULT 0,
  avg_latency_us INTEGER DEFAULT 0,
  bytes_processed BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_proto_gateways_agent ON agent_proto_gateways(agent_id);
CREATE INDEX idx_proto_mappings_gateway ON agent_proto_mappings(gateway_id);
CREATE INDEX idx_proto_metrics_gateway ON agent_proto_metrics(gateway_id);
