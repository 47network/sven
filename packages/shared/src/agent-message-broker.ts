export interface MessageBroker {
  id: string;
  agentId: string;
  name: string;
  brokerType: MessageBrokerType;
  connectionUrl: string;
  status: MessageBrokerStatus;
  maxConnections: number;
  heartbeatIntervalMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTopic {
  id: string;
  brokerId: string;
  name: string;
  partitionCount: number;
  replicationFactor: number;
  retentionHours: number;
  status: MessageTopicStatus;
  messageCount: number;
  createdAt: string;
}

export interface MessageSubscription {
  id: string;
  topicId: string;
  subscriberName: string;
  filterExpression: string | null;
  deliveryMode: MessageDeliveryMode;
  maxRetries: number;
  deadLetterTopic: string | null;
  status: MessageSubscriptionStatus;
  lag: number;
  createdAt: string;
}

export type MessageBrokerType = 'rabbitmq' | 'kafka' | 'nats' | 'redis_streams' | 'pulsar' | 'mqtt' | 'activemq' | 'zeromq';
export type MessageBrokerStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'draining' | 'maintenance';
export type MessageTopicStatus = 'active' | 'paused' | 'archived' | 'error';
export type MessageDeliveryMode = 'at_most_once' | 'at_least_once' | 'exactly_once';
export type MessageSubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'error';
