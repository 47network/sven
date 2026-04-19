export type TracePropagationType = 'w3c' | 'b3' | 'jaeger' | 'zipkin' | 'xray' | 'custom';
export type TraceConfigStatus = 'active' | 'disabled' | 'sampling' | 'error' | 'calibrating';
export type TraceSpanKind = 'server' | 'client' | 'producer' | 'consumer' | 'internal';
export type TraceSpanStatus = 'ok' | 'error' | 'unset';
export type TraceAnalysisType = 'latency' | 'error_rate' | 'throughput' | 'dependency' | 'anomaly' | 'bottleneck';
export type TraceAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TraceConfig {
  id: string;
  agent_id: string;
  config_name: string;
  sampling_rate: number;
  propagation_type: TracePropagationType;
  status: TraceConfigStatus;
  exporters: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TraceSpan {
  id: string;
  config_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  span_kind: TraceSpanKind;
  status: TraceSpanStatus;
  duration_ms: number;
  attributes: Record<string, unknown>;
  started_at: string;
  ended_at: string;
}

export interface TraceAnalysis {
  id: string;
  agent_id: string;
  analysis_type: TraceAnalysisType;
  status: TraceAnalysisStatus;
  results: Record<string, unknown>;
  trace_count: number;
  time_range_start?: string;
  time_range_end?: string;
  created_at: string;
  completed_at?: string;
}
