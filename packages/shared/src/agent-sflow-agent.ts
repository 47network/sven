export type SflowSampleType = 'flow' | 'counter' | 'expanded_flow' | 'expanded_counter';

export interface AgentSflowConfig { id: string; agent_id: string; sflow_name: string; agent_address: string; sub_agent_id: number; collector_address: string; collector_port: number; sampling_rate: number; polling_interval_sec: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentSflowCounter { id: string; config_id: string; interface_name: string; if_speed: number; if_in_octets: number; if_out_octets: number; if_in_errors: number; if_out_errors: number; if_in_discards: number; sampled_at: string; }
export interface AgentSflowSample { id: string; config_id: string; sample_type: SflowSampleType; source_ip: string | null; dest_ip: string | null; protocol: number | null; frame_length: number | null; sampled_at: string; }
