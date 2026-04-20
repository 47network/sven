export interface ClusterBalancerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  algorithm: string;
  healthCheckInterval: number;
  stickySessions: boolean;
  drainTimeoutSeconds: number;
  maxConnectionsPerNode: number;
  circuitBreakerEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface BalancerEndpoint {
  id: string;
  configId: string;
  nodeAddress: string;
  weight: number;
  healthy: boolean;
  activeConnections: number;
  lastHealthCheck: string;
}
export interface BalancerMetrics {
  id: string;
  configId: string;
  requestsPerSecond: number;
  avgLatencyMs: number;
  errorRate: number;
  activeNodes: number;
  collectedAt: string;
}
