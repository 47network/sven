// Batch 203: Stream Processor — real-time data stream processing

export type StreamSourceType = 'kafka' | 'nats' | 'redis_stream' | 'websocket' | 'http_sse' | 'file_tail' | 'mqtt' | 'amqp';
export type StreamSourceStatus = 'active' | 'inactive' | 'error' | 'draining' | 'paused';
export type StreamTransformType = 'filter' | 'map' | 'reduce' | 'aggregate' | 'join' | 'window' | 'enrich' | 'deduplicate';
export type StreamSinkType = 'postgresql' | 'opensearch' | 's3' | 'kafka' | 'nats' | 'http_webhook' | 'file' | 'redis';
export type StreamSinkStatus = 'active' | 'inactive' | 'error' | 'paused';

export interface StreamSource {
  id: string;
  agent_id: string;
  name: string;
  source_type: StreamSourceType;
  connection_config: Record<string, unknown>;
  status: StreamSourceStatus;
  throughput_rps: number;
  last_offset?: string;
  created_at: string;
  updated_at: string;
}

export interface StreamTransform {
  id: string;
  source_id: string;
  name: string;
  transform_type: StreamTransformType;
  config: Record<string, unknown>;
  ordering: number;
  enabled: boolean;
  created_at: string;
}

export interface StreamSink {
  id: string;
  source_id: string;
  name: string;
  sink_type: StreamSinkType;
  connection_config: Record<string, unknown>;
  status: StreamSinkStatus;
  messages_delivered: number;
  last_delivery_at?: string;
  created_at: string;
}

export type StreamProcessorEvent =
  | 'stream.source_created'
  | 'stream.source_active'
  | 'stream.source_error'
  | 'stream.sink_delivered';
