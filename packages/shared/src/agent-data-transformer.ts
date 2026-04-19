export type TransformFormat = 'json' | 'csv' | 'xml' | 'yaml' | 'parquet' | 'avro' | 'protobuf' | 'msgpack';
export type TransformStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RuleType = 'mapping' | 'filter' | 'aggregate' | 'split' | 'merge' | 'custom';
export type ValidationMode = 'strict' | 'lenient' | 'skip';

export interface DataTransformerConfig {
  id: string;
  agentId: string;
  defaultFormat: TransformFormat;
  maxPayloadMb: number;
  parallelWorkers: number;
  validationEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTransformation {
  id: string;
  configId: string;
  agentId: string;
  sourceFormat: TransformFormat;
  targetFormat: TransformFormat;
  inputSizeBytes: number;
  outputSizeBytes: number;
  recordsProcessed: number;
  status: TransformStatus;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface TransformationRule {
  id: string;
  configId: string;
  ruleName: string;
  ruleType: RuleType;
  sourceField: string;
  targetField: string;
  transformExpression?: string;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
