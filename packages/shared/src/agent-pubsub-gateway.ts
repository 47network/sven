export type PubsubProvider = 'nats' | 'google_pubsub' | 'aws_sns_sqs' | 'azure_servicebus' | 'rabbitmq';
export type SubscriptionState = 'active' | 'paused' | 'expired' | 'dead';
export interface AgentPubsubGwConfig {
  id: string; agent_id: string; provider: PubsubProvider; auth_mode: string;
  max_subscriptions: number; ack_wait_seconds: number; status: string; created_at: string; updated_at: string;
}
export interface AgentPubsubTopic {
  id: string; config_id: string; topic_name: string; partitions: number;
  retention_hours: number; subscriber_count: number; messages_total: number;
  state: string; created_at: string;
}
export interface AgentPubsubSubscription {
  id: string; topic_id: string; subscriber_id: string; filter_expression: string | null;
  ack_pending: number; delivered: number; state: SubscriptionState; created_at: string;
}
