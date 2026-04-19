export type MeshProtocol = 'http' | 'grpc' | 'tcp' | 'udp';
export type MtlsMode = 'strict' | 'permissive' | 'disabled';
export type MeshPolicyType = 'traffic' | 'security' | 'observability' | 'fault_injection';

export interface MeshService {
  id: string;
  agentId: string;
  name: string;
  namespace: string;
  protocol: MeshProtocol;
  port: number;
  targetPort: number;
  sidecarEnabled: boolean;
  mtlsMode: MtlsMode;
  healthCheckPath: string | null;
  replicas: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeshRoute {
  id: string;
  serviceId: string;
  matchPath: string;
  matchMethod: string | null;
  destinationServiceId: string;
  weight: number;
  timeoutMs: number;
  retryAttempts: number;
  circuitBreakerThreshold: number;
  rateLimitRps: number | null;
  createdAt: string;
}

export interface MeshPolicy {
  id: string;
  agentId: string;
  name: string;
  policyType: MeshPolicyType;
  targetServiceId: string | null;
  rules: Record<string, unknown>[];
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceMeshStats {
  totalServices: number;
  totalRoutes: number;
  totalPolicies: number;
  mtlsStrictCount: number;
  sidecarEnabledCount: number;
}
