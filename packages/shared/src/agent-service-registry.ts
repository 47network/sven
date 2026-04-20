// Batch 198: Service Registry — service discovery, health checks, endpoint management

export interface ServiceInstance {
  id: string;
  agentId: string;
  serviceName: string;
  serviceVersion: string;
  host: string;
  port: number;
  protocol: ServiceProtocol;
  healthStatus: ServiceHealthStatus;
  metadata: Record<string, unknown>;
  tags: string[];
  registeredAt: string;
  lastHeartbeatAt?: string;
  deregisteredAt?: string;
}

export interface ServiceHealthCheck {
  id: string;
  instanceId: string;
  checkType: HealthCheckType;
  endpoint?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastCheckAt?: string;
  lastStatus?: string;
  consecutiveFailures: number;
}

export interface ServiceEndpoint {
  id: string;
  instanceId: string;
  path: string;
  method: HttpMethodType;
  description?: string;
  rateLimit?: number;
  authRequired: boolean;
  metadata: Record<string, unknown>;
}

export type ServiceProtocol = 'http' | 'https' | 'grpc' | 'tcp' | 'udp' | 'ws' | 'wss';
export type ServiceHealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown' | 'draining';
export type HealthCheckType = 'http' | 'tcp' | 'grpc' | 'script' | 'ttl';
export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type ServiceRegistryEvent = 'service.registered' | 'service.deregistered' | 'service.health_changed' | 'service.endpoint_added';
