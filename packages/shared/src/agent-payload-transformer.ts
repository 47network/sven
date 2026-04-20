export type PayloadFormat = 'json' | 'xml' | 'csv' | 'protobuf' | 'avro' | 'msgpack';
export type TransformStatus = 'success' | 'failed' | 'partial';

export interface PayloadTransformerConfig {
  id: string;
  agentId: string;
  defaultFormat: PayloadFormat;
  maxPayloadSizeMb: number;
  validationEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TransformRule {
  id: string;
  configId: string;
  name: string;
  sourceFormat: PayloadFormat;
  targetFormat: PayloadFormat;
  transformSpec: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

export interface TransformLog {
  id: string;
  ruleId: string;
  inputSizeBytes: number;
  outputSizeBytes: number;
  durationMs: number;
  status: TransformStatus;
  errorMessage?: string;
  createdAt: string;
}
