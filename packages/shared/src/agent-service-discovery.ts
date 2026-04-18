// Batch 83 — Agent Service Discovery shared types

export type ServiceType = 'api' | 'worker' | 'scheduler' | 'gateway' | 'adapter' | 'processor' | 'monitor' | 'custom';
export type ServiceStatus = 'registered' | 'healthy' | 'degraded' | 'unhealthy' | 'deregistered';
export type HealthCheckType = 'http' | 'tcp' | 'script' | 'heartbeat' | 'grpc';
export type HealthCheckStatus = 'passing' | 'warning' | 'failing' | 'unknown';
export type DependencyType = 'required' | 'optional' | 'soft' | 'development';

export interface ServiceRegistryEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  serviceType: ServiceType;
  status: ServiceStatus;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'ws' | 'wss' | 'tcp' | 'nats';
  tags: string[];
  metadata: Record<string, unknown>;
  registeredBy?: string;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceHealthCheck {
  id: string;
  serviceId: string;
  checkType: HealthCheckType;
  endpoint?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastStatus?: HealthCheckStatus;
  lastCheckedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceEndpoint {
  id: string;
  serviceId: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  description?: string;
  authRequired: boolean;
  rateLimit?: number;
  schemaRequest?: unknown;
  schemaResponse?: unknown;
  deprecated: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceDependency {
  id: string;
  serviceId: string;
  dependsOn: string;
  dependencyType: DependencyType;
  versionConstraint?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveryEvent {
  id: string;
  serviceId: string;
  eventType: 'registered' | 'deregistered' | 'healthy' | 'degraded' | 'unhealthy' | 'endpoint_added' | 'endpoint_removed' | 'dependency_added' | 'config_changed';
  details: Record<string, unknown>;
  triggeredBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isServiceHealthy(entry: Pick<ServiceRegistryEntry, 'status'>): boolean {
  return entry.status === 'healthy';
}

export function serviceUptime(entry: Pick<ServiceRegistryEntry, 'createdAt'>): number {
  return Date.now() - new Date(entry.createdAt).getTime();
}

export function healthyServiceCount(entries: Pick<ServiceRegistryEntry, 'status'>[]): number {
  return entries.filter(e => e.status === 'healthy').length;
}
