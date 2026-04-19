export type DiscoveryMode = 'auto' | 'manual' | 'dns' | 'consul';
export type MeshHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';
export type LoadBalanceStrategy = 'round_robin' | 'least_connections' | 'random' | 'weighted';
export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ServiceMeshManagerConfig {
  id: string;
  agentId: string;
  meshName: string;
  discoveryMode: DiscoveryMode;
  loadBalanceStrategy: LoadBalanceStrategy;
  circuitBreakerEnabled: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeshService {
  id: string;
  configId: string;
  serviceName: string;
  version: string;
  endpoints: string[];
  healthStatus: MeshHealthStatus;
  instanceCount: number;
  trafficWeight: number;
  metadata: Record<string, unknown>;
  registeredAt: Date;
  updatedAt: Date;
}

export interface MeshRoute {
  id: string;
  configId: string;
  sourceService: string;
  destinationService: string;
  matchRules: Record<string, unknown>;
  retryPolicy: Record<string, unknown>;
  timeoutMs: number;
  circuitBreaker: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
}
