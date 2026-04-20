export type FirewallType = 'iptables' | 'nftables' | 'pf' | 'ipfw' | 'firewalld' | 'ufw';
export type ZoneModel = 'three_zone' | 'five_zone' | 'micro_segmented' | 'zero_trust';
export interface AgentFwPolicyConfig { id: string; agent_id: string; policy_name: string; firewall_type: FirewallType; target_host: string; zone_model: ZoneModel; enabled: boolean; created_at: string; updated_at: string; }
export interface AgentFwRule { id: string; config_id: string; chain: string; rule_number: number; action: string; protocol: string; src_addr: string; dst_addr: string; dst_port: string; state_match: string; log_enabled: boolean; comment: string; hit_count: number; created_at: string; }
export interface AgentFwChangeLog { id: string; config_id: string; change_type: string; old_value: Record<string, unknown>; new_value: Record<string, unknown>; reason: string; approved_by: string; applied_at: string; }
