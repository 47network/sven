export type RoutingStrategy = 'round_robin' | 'weighted' | 'least_connections' | 'hash' | 'random' | 'priority';

export interface RequestRouterConfig {
  id: string;
  agentId: string;
  routingStrategy: RoutingStrategy;
  healthCheckIntervalMs: number;
  stickySessions: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RouteRule {
  id: string;
  configId: string;
  pathPattern: string;
  targetService: string;
  weight: number;
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface RouteMetrics {
  id: string;
  ruleId: string;
  requestsTotal: number;
  requestsFailed: number;
  avgLatencyMs?: number;
  p99LatencyMs?: number;
  recordedAt: string;
}
