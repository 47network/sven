export type RoutingStrategy = 'round_robin' | 'least_connections' | 'weighted' | 'random' | 'consistent_hash';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceMeshRouterConfig {
  id: string;
  agentId: string;
  meshName: string;
  routingStrategy: RoutingStrategy;
  healthCheckIntervalMs: number;
  circuitBreakerEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeshService {
  id: string;
  configId: string;
  serviceName: string;
  endpointUrl: string;
  weight: number;
  healthStatus: HealthStatus;
  lastHealthCheck?: string;
  metadata: Record<string, unknown>;
}

export interface MeshTrafficRule {
  id: string;
  configId: string;
  ruleName: string;
  matchCriteria: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdAt: string;
}
