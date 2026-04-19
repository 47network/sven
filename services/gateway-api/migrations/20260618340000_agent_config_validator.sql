-- Agent Config Validator tables
CREATE TABLE IF NOT EXISTS agent_config_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  schema_name VARCHAR(255) NOT NULL,
  schema_type VARCHAR(50) NOT NULL CHECK (schema_type IN ('json_schema','yaml','toml','ini','env','hcl')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','draft','archived','testing')),
  schema_definition JSONB NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_config_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES agent_config_schemas(id),
  config_source VARCHAR(255) NOT NULL,
  validation_result VARCHAR(20) NOT NULL CHECK (validation_result IN ('valid','invalid','warning','error','skipped')),
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  config_snapshot JSONB DEFAULT '{}',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_config_drifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  config_path VARCHAR(512) NOT NULL,
  drift_type VARCHAR(50) NOT NULL CHECK (drift_type IN ('added','removed','modified','type_change','value_drift','permission')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  expected_value TEXT,
  actual_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_agent_config_schemas_agent ON agent_config_schemas(agent_id);
CREATE INDEX idx_agent_config_validations_schema ON agent_config_validations(schema_id);
CREATE INDEX idx_agent_config_drifts_agent ON agent_config_drifts(agent_id);
CREATE INDEX idx_agent_config_drifts_severity ON agent_config_drifts(severity);
