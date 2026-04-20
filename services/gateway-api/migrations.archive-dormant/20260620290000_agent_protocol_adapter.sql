-- Batch 392: Protocol Adapter
CREATE TABLE IF NOT EXISTS agent_protocol_adapter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  supported_protocols TEXT[] DEFAULT '{http,grpc,websocket}',
  default_protocol TEXT DEFAULT 'http',
  transformation_enabled BOOLEAN DEFAULT true,
  logging_level TEXT DEFAULT 'info',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_protocol_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_protocol_adapter_configs(id),
  name TEXT NOT NULL,
  source_protocol TEXT NOT NULL,
  target_protocol TEXT NOT NULL,
  transformation_rules JSONB DEFAULT '{}',
  request_template JSONB,
  response_template JSONB,
  active BOOLEAN DEFAULT true,
  invocation_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_protocol_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES agent_protocol_mappings(id),
  source_payload JSONB,
  target_payload JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proto_configs_agent ON agent_protocol_adapter_configs(agent_id);
CREATE INDEX idx_proto_mappings_config ON agent_protocol_mappings(config_id);
CREATE INDEX idx_proto_mappings_active ON agent_protocol_mappings(active);
CREATE INDEX idx_proto_conversions_mapping ON agent_protocol_conversions(mapping_id);
CREATE INDEX idx_proto_conversions_status ON agent_protocol_conversions(status);
