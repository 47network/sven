export type RelayProtocol = 'nats' | 'amqp' | 'mqtt' | 'redis_streams' | 'kafka';
export type ChannelType = 'topic' | 'queue' | 'fanout' | 'direct';
export type DlqState = 'pending' | 'retrying' | 'exhausted' | 'resolved';
export interface AgentMsgRelayConfig {
  id: string; agent_id: string; protocol: RelayProtocol; max_retries: number;
  dlq_enabled: boolean; batch_size: number; status: string; created_at: string; updated_at: string;
}
export interface AgentMsgChannel {
  id: string; config_id: string; channel_name: string; channel_type: ChannelType;
  subscribers: number; messages_total: number; state: string; created_at: string;
}
export interface AgentMsgDlq {
  id: string; channel_id: string; original_subject: string; payload: Record<string, unknown>;
  error: string | null; retry_count: number; max_retries: number; state: DlqState; created_at: string;
}
