export type RoutingMode = 'content_based' | 'header_based' | 'topic_based' | 'round_robin' | 'broadcast';
export type RouteState = 'active' | 'paused' | 'disabled';
export interface AgentEventRtrConfig {
  id: string; agent_id: string; routing_mode: RoutingMode; max_fanout: number;
  dead_letter: boolean; status: string; created_at: string; updated_at: string;
}
export interface AgentRoutingRule {
  id: string; config_id: string; rule_name: string; source_pattern: string;
  target_subjects: string[]; filter_expression: Record<string, unknown>; priority: number;
  active: boolean; created_at: string;
}
export interface AgentRoutedEvent {
  id: string; rule_id: string; source_subject: string; target_subject: string;
  payload_size_bytes: number; latency_ms: number; success: boolean; routed_at: string;
}
