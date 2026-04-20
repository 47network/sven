-- Batch 428: Payload Transformer
CREATE TABLE IF NOT EXISTS agent_payload_transformer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_format TEXT NOT NULL DEFAULT 'json' CHECK (default_format IN ('json','xml','csv','protobuf','avro','msgpack')),
  max_payload_size_mb INTEGER NOT NULL DEFAULT 10,
  validation_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_transform_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_payload_transformer_configs(id),
  name TEXT NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  transform_spec JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_transform_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_transform_rules(id),
  input_size_bytes INTEGER NOT NULL,
  output_size_bytes INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_payload_transformer_configs_agent ON agent_payload_transformer_configs(agent_id);
CREATE INDEX idx_agent_transform_rules_config ON agent_transform_rules(config_id);
CREATE INDEX idx_agent_transform_logs_rule ON agent_transform_logs(rule_id);
