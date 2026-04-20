export type LBAlgorithm = 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash' | 'consistent_hash' | 'random';
export type BackendStatus = 'healthy' | 'unhealthy' | 'draining' | 'removed';
export type HealthCheckResult = 'pass' | 'fail' | 'timeout';

export interface LoadBalancerAgentConfig {
  id: string;
  agentId: string;
  algorithm: LBAlgorithm;
  maxBackends: number;
  drainTimeoutMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LBBackend {
  id: string;
  configId: string;
  address: string;
  port: number;
  weight: number;
  maxConnections: number;
  status: BackendStatus;
  createdAt: string;
}

export interface LBHealthCheck {
  id: string;
  backendId: string;
  status: HealthCheckResult;
  responseTimeMs?: number;
  statusCode?: number;
  checkedAt: string;
}
