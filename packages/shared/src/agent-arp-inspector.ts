export type ArpTrustMode = 'strict' | 'relaxed' | 'permissive';
export type ArpBindingType = 'static' | 'dynamic' | 'dhcp_snooped';
export type ArpViolationType = 'ip_mac_mismatch' | 'gratuitous_arp_flood' | 'arp_spoofing' | 'rate_exceeded';

export interface AgentArpConfig { id: string; agent_id: string; inspector_name: string; monitored_vlans: string; rate_limit_pps: number; trust_mode: ArpTrustMode; log_denied: boolean; dhcp_snooping: boolean; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentArpBinding { id: string; config_id: string; ip_address: string; mac_address: string; vlan_id: number | null; interface_name: string | null; binding_type: ArpBindingType; verified: boolean; created_at: string; }
export interface AgentArpViolation { id: string; config_id: string; violation_type: ArpViolationType; source_ip: string | null; source_mac: string | null; expected_mac: string | null; interface_name: string | null; action_taken: string; detected_at: string; }
