export type ProbeType = 'icmp' | 'tcp' | 'udp' | 'http';

export interface AgentLatencyConfig { id: string; agent_id: string; probe_name: string; target_host: string; probe_type: ProbeType; interval_sec: number; timeout_ms: number; packet_count: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentLatencyResult { id: string; config_id: string; min_ms: number; max_ms: number; avg_ms: number; stddev_ms: number; packets_sent: number; packets_received: number; probed_at: string; }
export interface AgentLatencyBaseline { id: string; config_id: string; baseline_avg_ms: number; baseline_p95_ms: number; baseline_p99_ms: number; sample_count: number; period_start: string; period_end: string; created_at: string; }
