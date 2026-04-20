export type TraceStatus = 'ok' | 'error' | 'timeout' | 'cancelled' | 'unset';

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export type SamplingDecision = 'record_and_sample' | 'record_only' | 'drop';

export type TracePropagation = 'w3c' | 'b3' | 'jaeger' | 'custom';

export type TraceExporter = 'otlp' | 'jaeger' | 'zipkin' | 'console' | 'noop';

export interface TraceRecord {
  id: string;
  traceId: string;
  name: string;
  serviceName: string;
  status: TraceStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  rootSpanId?: string;
  spanCount: number;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  serviceName: string;
  spanKind: SpanKind;
  status: TraceStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  attributes: Record<string, unknown>;
  events: unknown[];
  links: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TraceBaggage {
  id: string;
  traceId: string;
  key: string;
  value: string;
  metadata?: string;
  createdAt: string;
}

export interface TraceSamplingRule {
  id: string;
  name: string;
  servicePattern?: string;
  operationPattern?: string;
  sampleRate: number;
  maxTracesPerSecond?: number;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TraceAnalytics {
  id: string;
  serviceName: string;
  operation: string;
  periodStart: string;
  periodEnd: string;
  totalTraces: number;
  errorTraces: number;
  avgDurationMs?: number;
  p50DurationMs?: number;
  p95DurationMs?: number;
  p99DurationMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isTraceError(trace: TraceRecord): boolean {
  return trace.status === 'error';
}

export function spanDepth(span: TraceSpan): number {
  return span.parentSpanId ? 1 : 0;
}

export function traceErrorRate(analytics: TraceAnalytics): number {
  return analytics.totalTraces > 0 ? analytics.errorTraces / analytics.totalTraces : 0;
}
