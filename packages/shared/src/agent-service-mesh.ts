// Batch 75: Agent Service Mesh & Discovery — shared types

export type ServiceProtocol = 'http' | 'grpc' | 'ws' | 'tcp' | 'nats';
export type ServiceStatus = 'registered' | 'healthy' | 'degraded' | 'unhealthy' | 'deregistered';
export type DependencyType = 'required' | 'optional' | 'weak';
export type HealthCheckType = 'http' | 'tcp' | 'grpc' | 'script' | 'nats';
export type LoadBalanceStrategy = 'round_robin' | 'weighted' | 'least_conn' | 'random' | 'consistent_hash';

export interface ServiceRegistryEntry {
  id: string;
  service_name: string;
  version: string;
  protocol: ServiceProtocol;
  host: string;
  port: number;
  health_path: string;
  status: ServiceStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  registered_at: string;
  last_heartbeat?: string;
  updated_at: string;
}

export interface ServiceEndpoint {
  id: string;
  service_id: string;
  path: string;
  method: string;
  description?: string;
  rate_limit?: number;
  timeout_ms: number;
  retries: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ServiceDependency {
  id: string;
  service_id: string;
  depends_on: string;
  dep_type: DependencyType;
  min_version?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ServiceHealthCheck {
  id: string;
  service_id: string;
  check_type: HealthCheckType;
  interval_sec: number;
  timeout_ms: number;
  last_status: string;
  last_output?: string;
  consecutive_failures: number;
  checked_at?: string;
  created_at: string;
}

export interface MeshTrafficPolicy {
  id: string;
  policy_name: string;
  source_service?: string;
  target_service?: string;
  strategy: LoadBalanceStrategy;
  circuit_breaker: Record<string, unknown>;
  retry_policy: Record<string, unknown>;
  timeout_policy: Record<string, unknown>;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const SERVICE_STATUS_ORDER: ServiceStatus[] = ['registered', 'healthy', 'degraded', 'unhealthy', 'deregistered'];

export function isServiceAvailable(status: ServiceStatus): boolean {
  return status === 'healthy' || status === 'degraded';
}

export function buildServiceUrl(entry: ServiceRegistryEntry): string {
  return `${entry.protocol}://${entry.host}:${entry.port}`;
}

export function shouldRetry(failures: number, maxRetries: number): boolean {
  return failures < maxRetries;
}
