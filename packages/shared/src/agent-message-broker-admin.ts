export type BrokerType = 'nats' | 'rabbitmq' | 'kafka' | 'redis_streams' | 'pulsar';
export type TopicStatus = 'active' | 'inactive' | 'archived';
export type BrokerHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

export interface MessageBrokerAdminConfig {
  id: string;
  agentId: string;
  brokerType: BrokerType;
  connectionUrl: string;
  monitoringEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerTopic {
  id: string;
  configId: string;
  topicName: string;
  partitionCount: number;
  retentionHours: number;
  subscriberCount: number;
  status: TopicStatus;
  createdAt: string;
}

export interface BrokerHealthCheck {
  id: string;
  configId: string;
  status: BrokerHealthStatus;
  latencyMs?: number;
  messageRate?: number;
  errorRate: number;
  checkedAt: string;
}
