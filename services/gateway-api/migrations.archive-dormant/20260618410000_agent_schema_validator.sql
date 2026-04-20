-- Batch 204: Schema Validator
-- Data schema validation, evolution, and compatibility checking

CREATE TABLE IF NOT EXISTS agent_schema_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  schema_format VARCHAR(50) NOT NULL CHECK (schema_format IN ('json_schema','avro','protobuf','thrift','xml_schema','openapi','graphql','parquet')),
  version INT NOT NULL DEFAULT 1,
  schema_content JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','deprecated','archived')),
  fingerprint VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, name, version)
);

CREATE TABLE IF NOT EXISTS agent_schema_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES agent_schema_definitions(id),
  input_data JSONB NOT NULL,
  is_valid BOOLEAN NOT NULL,
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_schema_evolution_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES agent_schema_definitions(id),
  previous_version INT NOT NULL,
  new_version INT NOT NULL,
  compatibility_mode VARCHAR(30) NOT NULL CHECK (compatibility_mode IN ('backward','forward','full','none','transitive_backward','transitive_forward','transitive_full')),
  is_compatible BOOLEAN NOT NULL,
  breaking_changes JSONB DEFAULT '[]',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schema_defs_agent ON agent_schema_definitions(agent_id);
CREATE INDEX idx_schema_defs_name ON agent_schema_definitions(name);
CREATE INDEX idx_schema_validations_schema ON agent_schema_validations(schema_id);
CREATE INDEX idx_schema_evolution_schema ON agent_schema_evolution_checks(schema_id);
