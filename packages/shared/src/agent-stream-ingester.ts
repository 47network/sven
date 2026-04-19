export type SourceType = 'kafka' | 'kinesis' | 'pulsar' | 'nats_jetstream' | 'redpanda';
export type PartitionState = 'consuming' | 'paused' | 'rebalancing' | 'stopped';
export interface AgentStreamIngConfig {
  id: string; agent_id: string; source_type: SourceType; consumer_group: string;
  auto_offset_reset: string; max_poll_records: number; status: string; created_at: string; updated_at: string;
}
export interface AgentStreamPartition {
  id: string; config_id: string; topic: string; partition_id: number;
  current_offset: number; lag: number; state: PartitionState; last_poll_at: string | null;
}
export interface AgentStreamCheckpoint {
  id: string; config_id: string; topic: string; partition_id: number;
  committed_offset: number; records_processed: number; checkpoint_at: string;
}
