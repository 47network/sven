export type FlowProtocol = 'netflow_v5' | 'netflow_v9' | 'ipfix' | 'sflow';
export type FlowReportType = 'top_talkers' | 'protocol_breakdown' | 'bandwidth_usage' | 'anomaly';

export interface AgentFlowConfig { id: string; agent_id: string; collector_name: string; listen_port: number; protocol: FlowProtocol; sampling_rate: number; aggregation_interval_sec: number; retention_days: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentFlowRecord { id: string; config_id: string; source_ip: string; dest_ip: string; source_port: number | null; dest_port: number | null; protocol: number; bytes_total: number; packets_total: number; flow_start: string; flow_end: string | null; created_at: string; }
export interface AgentFlowReport { id: string; config_id: string; report_type: FlowReportType; period_start: string; period_end: string; top_talkers: Record<string, unknown>[]; protocol_breakdown: Record<string, unknown>; total_bytes: number; created_at: string; }
