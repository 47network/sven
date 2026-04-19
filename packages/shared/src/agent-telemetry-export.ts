/* Batch 158 — Agent Telemetry Export */

export type AgentTelemetrySinkType =
  | 'prometheus'
  | 'grafana'
  | 'datadog'
  | 'otlp'
  | 'cloudwatch'
  | 'elasticsearch'
  | 'custom';

export type AgentTelemetryAuthMethod = 'bearer' | 'basic' | 'api_key' | 'mtls' | 'none';

export type AgentTelemetrySinkStatus = 'active' | 'paused' | 'error' | 'disabled';

export type AgentTelemetrySignalType = 'metrics' | 'traces' | 'logs' | 'events';

export type AgentTelemetryExportStatus = 'pending' | 'exporting' | 'completed' | 'failed' | 'retrying';

export interface AgentTelemetrySink {
  id: string;
  tenantId: string;
  sinkName: string;
  sinkType: AgentTelemetrySinkType;
  endpointUrl: string;
  authMethod: AgentTelemetryAuthMethod;
  status: AgentTelemetrySinkStatus;
  filterRules: Record<string, unknown>;
  batchSize: number;
  flushInterval: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTelemetryPipeline {
  id: string;
  sinkId: string;
  pipelineName: string;
  signalType: AgentTelemetrySignalType;
  transformRules: unknown[];
  samplingRate: number;
  enabled: boolean;
  lastExportAt: string | null;
  exportCount: number;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentTelemetryExportEntry {
  id: string;
  pipelineId: string;
  batchId: string;
  recordCount: number;
  byteSize: number;
  status: AgentTelemetryExportStatus;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface AgentTelemetryExportStats {
  totalSinks: number;
  activePipelines: number;
  totalExported: number;
  failedExports: number;
  avgBatchSize: number;
}
