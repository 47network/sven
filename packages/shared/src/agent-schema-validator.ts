export type SchemaType = 'json_schema' | 'avro' | 'protobuf' | 'openapi' | 'graphql' | 'custom';
export type SchemaCompatibility = 'backward' | 'forward' | 'full' | 'none';

export interface SchemaValidatorConfig {
  id: string;
  agentId: string;
  strictMode: boolean;
  cacheSchemas: boolean;
  maxSchemaSizeKb: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSchema {
  id: string;
  configId: string;
  name: string;
  version: string;
  schemaType: SchemaType;
  definition: Record<string, unknown>;
  isLatest: boolean;
  compatibility: SchemaCompatibility;
  createdAt: Date;
}

export interface SchemaValidation {
  id: string;
  schemaId: string;
  inputHash: string;
  isValid: boolean;
  errors?: Record<string, unknown>[];
  warnings?: Record<string, unknown>[];
  validatedAt: Date;
}
