export type SchedulingAlgo = 'wrr' | 'wfq' | 'cbq' | 'hfsc' | 'htb' | 'prio';
export type DscpMarking = 'ef' | 'af11' | 'af21' | 'af31' | 'af41' | 'cs1' | 'cs5' | 'cs7' | 'be';
export interface AgentQosConfig { id: string; agent_id: string; enforcer_name: string; interface_name: string; scheduling_algo: SchedulingAlgo; total_bandwidth: number; enabled: boolean; created_at: string; updated_at: string; }
export interface AgentQosClass { id: string; config_id: string; class_name: string; priority: number; min_bandwidth: number; max_bandwidth: number; burst_size: number; dscp_marking: DscpMarking; packet_count: number; byte_count: number; created_at: string; }
export interface AgentQosViolation { id: string; class_id: string; violation_type: string; details: Record<string, unknown>; detected_at: string; }
