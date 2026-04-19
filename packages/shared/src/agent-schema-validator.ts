// Batch 204: Schema Validator — data schema validation and evolution

export type SchemaFormat = 'json_schema' | 'avro' | 'protobuf' | 'thrift' | 'xml_schema' | 'openapi' | 'graphql' | 'parquet';
export type SchemaDefinitionStatus = 'draft' | 'active' | 'deprecated' | 'archived';
export type SchemaCompatibilityMode = 'backward' | 'forward' | 'full' | 'none' | 'transitive_backward' | 'transitive_forward' | 'transitive_full';

export interface SchemaDefinition {
  id: string;
  agent_id: string;
  name: string;
  schema_format: SchemaFormat;
  version: number;
  schema_content: Record<string, unknown>;
  status: SchemaDefinitionStatus;
  fingerprint?: string;
  created_at: string;
  updated_at: string;
}

export interface SchemaValidation {
  id: string;
  schema_id: string;
  input_data: Record<string, unknown>;
  is_valid: boolean;
  errors: unknown[];
  warnings: unknown[];
  validated_at: string;
}

export interface SchemaEvolutionCheck {
  id: string;
  schema_id: string;
  previous_version: number;
  new_version: number;
  compatibility_mode: SchemaCompatibilityMode;
  is_compatible: boolean;
  breaking_changes: unknown[];
  checked_at: string;
}

export type SchemaValidatorEvent =
  | 'schema.definition_created'
  | 'schema.validation_failed'
  | 'schema.evolution_checked'
  | 'schema.compatibility_broken';
