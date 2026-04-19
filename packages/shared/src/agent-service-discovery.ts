export type ServiceType = 'skill' | 'api' | 'webhook' | 'stream' | 'cron' | 'queue' | 'rpc';
export type ProbeType = 'health' | 'capability' | 'latency' | 'load' | 'version';
export type ProbeResult = 'pass' | 'fail' | 'timeout' | 'degraded';

export interface ServiceRegistryEntry {
  id: string;
  agentId: string;
  serviceName: string;
  serviceType: ServiceType;
  endpoint: string | null;
  version: string;
  healthy: boolean;
  lastHeartbeat: string | null;
  capabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryProbe {
  id: string;
  registryId: string;
  probeType: ProbeType;
  result: ProbeResult;
  latencyMs: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceDependency {
  id: string;
  serviceId: string;
  dependsOnServiceId: string;
  required: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceDiscoveryStats {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  totalProbes: number;
  passRate: number;
  avgLatencyMs: number;
}
