export type JitterDirection = 'inbound' | 'outbound' | 'both';

export interface AgentJitterConfig { id: string; agent_id: string; analyzer_name: string; target_host: string; sample_interval_ms: number; window_size: number; max_acceptable_ms: number; mos_threshold: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentJitterSample { id: string; config_id: string; jitter_ms: number; inter_arrival_ms: number; sequence_number: number; direction: JitterDirection; sampled_at: string; }
export interface AgentJitterReport { id: string; config_id: string; avg_jitter_ms: number; max_jitter_ms: number; p95_jitter_ms: number; mos_score: number; sample_count: number; period_start: string; period_end: string; created_at: string; }
