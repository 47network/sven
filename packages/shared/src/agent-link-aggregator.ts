export type LagMode = 'active-backup' | 'balance-rr' | 'balance-xor' | '802.3ad' | 'broadcast';
export type LagHashPolicy = 'layer2' | 'layer3+4' | 'layer2+3' | 'encap3+4';
export type LagLinkState = 'up' | 'down' | 'testing' | 'unknown';

export interface AgentLagGroup {
  id: string;
  agent_id: string;
  group_name: string;
  mode: LagMode;
  hash_policy: LagHashPolicy;
  min_links: number;
  lacp_rate: string;
  mii_monitor_ms: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentLagMember {
  id: string;
  group_id: string;
  interface_name: string;
  speed_mbps: number;
  status: string;
  priority: number;
  link_state: LagLinkState;
  rx_bytes: number;
  tx_bytes: number;
  created_at: string;
}

export interface AgentLagStat {
  id: string;
  group_id: string;
  period_start: string;
  total_throughput_mbps: number;
  active_links: number;
  failover_count: number;
  balance_score: number;
  created_at: string;
}
