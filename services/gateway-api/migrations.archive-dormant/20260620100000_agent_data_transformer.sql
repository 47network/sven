CREATE TABLE IF NOT EXISTS agent_data_transformer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_format TEXT NOT NULL DEFAULT 'json',
  max_payload_mb INTEGER NOT NULL DEFAULT 100,
  parallel_workers INTEGER NOT NULL DEFAULT 4,
  validation_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_transformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_transformer_configs(id),
  agent_id UUID NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  input_size_bytes BIGINT NOT NULL DEFAULT 0,
  output_size_bytes BIGINT NOT NULL DEFAULT 0,
  records_processed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_transformation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_transformer_configs(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'mapping',
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transform_expression TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transformations_agent ON agent_transformations(agent_id);
CREATE INDEX IF NOT EXISTS idx_transformations_status ON agent_transformations(status);
CREATE INDEX IF NOT EXISTS idx_transformation_rules_config ON agent_transformation_rules(config_id);
