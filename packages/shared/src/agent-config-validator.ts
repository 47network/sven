export type ConfigSchemaType = 'json_schema' | 'yaml' | 'toml' | 'ini' | 'env' | 'hcl';
export type ConfigSchemaStatus = 'active' | 'deprecated' | 'draft' | 'archived' | 'testing';
export type ConfigValidationResult = 'valid' | 'invalid' | 'warning' | 'error' | 'skipped';
export type ConfigDriftType = 'added' | 'removed' | 'modified' | 'type_change' | 'value_drift' | 'permission';
export type ConfigDriftSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ConfigSchema {
  id: string;
  agent_id: string;
  schema_name: string;
  schema_type: ConfigSchemaType;
  status: ConfigSchemaStatus;
  schema_definition: Record<string, unknown>;
  version: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConfigValidation {
  id: string;
  schema_id: string;
  config_source: string;
  validation_result: ConfigValidationResult;
  errors: unknown[];
  warnings: unknown[];
  config_snapshot: Record<string, unknown>;
  validated_at: string;
}

export interface ConfigDrift {
  id: string;
  agent_id: string;
  config_path: string;
  drift_type: ConfigDriftType;
  severity: ConfigDriftSeverity;
  expected_value?: string;
  actual_value?: string;
  detected_at: string;
  resolved_at?: string;
  metadata: Record<string, unknown>;
}
