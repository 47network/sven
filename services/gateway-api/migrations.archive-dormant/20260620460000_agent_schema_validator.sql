-- Batch 409: Schema Validator
-- Validates data structures against schemas with versioning and compatibility checks

CREATE TABLE IF NOT EXISTS agent_schema_validator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  strict_mode BOOLEAN NOT NULL DEFAULT true,
  cache_schemas BOOLEAN NOT NULL DEFAULT true,
  max_schema_size_kb INTEGER NOT NULL DEFAULT 1024,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_schema_validator_configs(id),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_type TEXT NOT NULL CHECK (schema_type IN ('json_schema', 'avro', 'protobuf', 'openapi', 'graphql', 'custom')),
  definition JSONB NOT NULL,
  is_latest BOOLEAN NOT NULL DEFAULT true,
  compatibility TEXT NOT NULL DEFAULT 'backward' CHECK (compatibility IN ('backward', 'forward', 'full', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, name, version)
);

CREATE TABLE IF NOT EXISTS agent_schema_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES agent_schemas(id),
  input_hash TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  errors JSONB,
  warnings JSONB,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_schemas_config ON agent_schemas(config_id);
CREATE INDEX idx_agent_schemas_name ON agent_schemas(config_id, name) WHERE is_latest = true;
CREATE INDEX idx_agent_schema_validations_schema ON agent_schema_validations(schema_id);
