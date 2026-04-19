export type QueueType = 'fifo' | 'priority' | 'delay' | 'circular' | 'dedup';
export type QueueState = 'active' | 'paused' | 'draining' | 'disabled';
export interface AgentQueueMgrConfig {
  id: string; agent_id: string; queue_type: QueueType; max_size: number;
  visibility_timeout_seconds: number; retention_hours: number; status: string;
  created_at: string; updated_at: string;
}
export interface AgentQueue {
  id: string; config_id: string; queue_name: string; depth: number;
  in_flight: number; consumers: number; state: QueueState; created_at: string;
}
export interface AgentQueueMetrics {
  id: string; queue_id: string; enqueued: number; dequeued: number; failed: number;
  avg_latency_ms: number; max_depth: number; recorded_at: string;
}
