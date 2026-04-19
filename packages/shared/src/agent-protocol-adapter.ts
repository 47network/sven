export type ProtocolType = 'http' | 'grpc' | 'websocket' | 'mqtt' | 'amqp' | 'graphql';
export type ConversionStatus = 'success' | 'failed' | 'partial';
export type LoggingLevel = 'debug' | 'info' | 'warn' | 'error';
export type TransformMode = 'passthrough' | 'template' | 'script' | 'jq';

export interface ProtocolAdapterConfig {
  id: string;
  agentId: string;
  supportedProtocols: ProtocolType[];
  defaultProtocol: ProtocolType;
  transformationEnabled: boolean;
  loggingLevel: LoggingLevel;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProtocolMapping {
  id: string;
  configId: string;
  name: string;
  sourceProtocol: ProtocolType;
  targetProtocol: ProtocolType;
  transformationRules: Record<string, unknown>;
  requestTemplate: Record<string, unknown> | null;
  responseTemplate: Record<string, unknown> | null;
  active: boolean;
  invocationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProtocolConversion {
  id: string;
  mappingId: string;
  sourcePayload: Record<string, unknown> | null;
  targetPayload: Record<string, unknown> | null;
  status: ConversionStatus;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}
