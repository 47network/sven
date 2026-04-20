export type EdgeTlsMode = 'terminate' | 'passthrough' | 'mutual';
export type EdgeRouterStatus = 'active' | 'standby' | 'maintenance' | 'error';
export type EdgeCacheStatus = 'hit' | 'miss' | 'bypass' | 'expired';

export interface AgentEdgeConfig {
  id: string;
  agentId: string;
  routerName: string;
  edgeLocation: string;
  upstreamTargets: string[];
  healthCheckPath: string;
  tlsMode: EdgeTlsMode;
  compressionEnabled: boolean;
  cacheTtlSeconds: number;
  status: EdgeRouterStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentEdgeRoute {
  id: string;
  configId: string;
  pathPattern: string;
  upstreamTarget: string;
  methods: string[];
  stripPrefix: boolean;
  rateLimitRps: number | null;
  timeoutMs: number;
  retryCount: number;
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface AgentEdgeAccessLog {
  id: string;
  configId: string;
  clientIp: string;
  method: string;
  path: string;
  upstreamTarget: string | null;
  statusCode: number;
  responseTimeMs: number;
  cacheStatus: EdgeCacheStatus | null;
  bytesSent: number;
  tlsVersion: string | null;
  createdAt: string;
}
