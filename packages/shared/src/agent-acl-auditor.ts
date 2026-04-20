export type AclType = 'standard' | 'extended' | 'named' | 'reflexive' | 'time_based';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface AgentAclConfig { id: string; agent_id: string; auditor_name: string; target_device: string; acl_type: AclType; scan_schedule: string; enabled: boolean; created_at: string; updated_at: string; }
export interface AgentAclEntry { id: string; config_id: string; rule_number: number; action: string; protocol: string; src_network: string; dst_network: string; port_range: string; hit_count: number; last_hit_at: string; is_shadowed: boolean; created_at: string; }
export interface AgentAclFinding { id: string; config_id: string; finding_type: string; severity: FindingSeverity; description: string; affected_rules: number[]; recommendation: string; resolved: boolean; found_at: string; }
