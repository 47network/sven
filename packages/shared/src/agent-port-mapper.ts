export type ScanMethod = 'syn' | 'connect' | 'udp' | 'fin' | 'xmas' | 'null' | 'ack';
export type PortState = 'open' | 'closed' | 'filtered' | 'unfiltered' | 'open_filtered' | 'closed_filtered';
export interface AgentPortMapConfig { id: string; agent_id: string; mapper_name: string; target_network: string; scan_method: ScanMethod; port_range: string; scan_schedule: string; enabled: boolean; created_at: string; updated_at: string; }
export interface AgentPortMapResult { id: string; config_id: string; host_ip: string; port: number; protocol: string; state: PortState; service_name: string; service_version: string; banner: string; scanned_at: string; }
export interface AgentPortMapChange { id: string; config_id: string; host_ip: string; port: number; change_type: string; old_state: string; new_state: string; detected_at: string; }
