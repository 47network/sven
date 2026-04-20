export type TraceFormat = 'opentelemetry' | 'jaeger' | 'zipkin' | 'datadog';
export type PropagationFormat = 'w3c' | 'b3' | 'jaeger' | 'datadog';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface AgentTraceCollectorConfig {
  id: string;
  agentId: string;
  name: string;
  samplingRate: number;
  maxSpansPerTrace: number;
  retentionDays: number;
  traceFormat: TraceFormat;
  propagationFormat: PropagationFormat;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTraceSpan {
  id: string;
  configId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  status: SpanStatus;
  durationMs?: number;
  attributes: Record<string, unknown>;
  events: unknown[];
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
}

export interface AgentTraceAnalysis {
  id: string;
  configId: string;
  traceId: string;
  totalSpans: number;
  totalDurationMs?: number;
  bottleneckSpanId?: string;
  errorCount: number;
  analysisResult: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
