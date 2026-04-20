export type ClassificationMethod = 'dpi' | 'port_based' | 'heuristic' | 'ml_based' | 'signature';
export type TrafficCategory = 'web' | 'streaming' | 'gaming' | 'voip' | 'email' | 'file_transfer' | 'vpn' | 'malicious' | 'unknown';
export interface AgentTrafficClassConfig { id: string; agent_id: string; classifier_name: string; interface_name: string; classification_method: ClassificationMethod; rules: Record<string, unknown>[]; enabled: boolean; created_at: string; updated_at: string; }
export interface AgentTrafficClassResult { id: string; config_id: string; flow_id: string; src_ip: string; dst_ip: string; protocol: string; application: string; category: TrafficCategory; confidence: number; bytes_transferred: number; classified_at: string; }
export interface AgentTrafficClassPolicy { id: string; config_id: string; policy_name: string; match_criteria: Record<string, unknown>; action: string; priority: number; hit_count: number; created_at: string; }
