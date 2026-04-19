export type ProtoTransformType = 'direct' | 'json_to_xml' | 'xml_to_json' | 'protobuf_to_json' | 'mqtt_to_http' | 'custom';
export type ProtoSourceProtocol = 'mqtt' | 'amqp' | 'coap' | 'modbus' | 'opcua' | 'http' | 'websocket' | 'grpc';
export type ProtoTargetProtocol = 'http' | 'grpc' | 'mqtt' | 'amqp' | 'kafka' | 'nats' | 'websocket';

export interface AgentProtoGateway {
  id: string;
  agent_id: string;
  gateway_name: string;
  source_protocol: ProtoSourceProtocol;
  target_protocol: ProtoTargetProtocol;
  listen_address: string;
  forward_address: string;
  transform_rules: Record<string, unknown>[];
  buffer_size_kb: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentProtoMapping {
  id: string;
  gateway_id: string;
  mapping_name: string;
  source_field: string;
  target_field: string;
  transform_type: ProtoTransformType;
  transform_config: Record<string, unknown>;
  created_at: string;
}

export interface AgentProtoMetric {
  id: string;
  gateway_id: string;
  period_start: string;
  messages_translated: number;
  translation_errors: number;
  avg_latency_us: number;
  bytes_processed: number;
  created_at: string;
}
