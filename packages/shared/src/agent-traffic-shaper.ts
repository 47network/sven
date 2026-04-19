export type ShaperPriorityClass = 'realtime' | 'high' | 'default' | 'low' | 'bulk' | 'scavenger';
export type ShaperPolicyStatus = 'active' | 'inactive' | 'enforcing' | 'monitoring';
export type QosAction = 'shape' | 'police' | 'mark' | 'drop' | 'queue';

export interface AgentShaperPolicy {
  id: string;
  agent_id: string;
  policy_name: string;
  max_bandwidth_mbps: number;
  burst_size_kb: number;
  priority_class: ShaperPriorityClass;
  qos_enabled: boolean;
  status: ShaperPolicyStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentShaperRule {
  id: string;
  policy_id: string;
  rule_name: string;
  match_criteria: Record<string, unknown>;
  bandwidth_limit_mbps: number | null;
  latency_target_ms: number | null;
  packet_loss_pct: number;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface AgentShaperStat {
  id: string;
  policy_id: string;
  throughput_mbps: number | null;
  packets_shaped: number;
  packets_dropped: number;
  avg_latency_ms: number | null;
  queue_depth: number;
  recorded_at: string;
}
