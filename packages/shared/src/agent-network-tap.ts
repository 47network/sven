export type TapCaptureMode = 'passive' | 'inline' | 'aggregation';
export type TapSessionStatus = 'active' | 'paused' | 'stopped' | 'error';

export interface AgentTapConfig { id: string; agent_id: string; tap_name: string; capture_interface: string; mirror_port: string | null; filter_expression: string | null; capture_mode: TapCaptureMode; buffer_size_mb: number; snap_length: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentTapSession { id: string; tap_id: string; session_name: string; status: TapSessionStatus; packets_captured: number; bytes_captured: number; started_at: string; stopped_at: string | null; output_path: string | null; created_at: string; }
export interface AgentTapFilter { id: string; tap_id: string; filter_name: string; bpf_expression: string; priority: number; enabled: boolean; created_at: string; }
