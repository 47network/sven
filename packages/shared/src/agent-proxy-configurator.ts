export interface ProxyConfiguratorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  proxyType: string;
  upstreamTargets: string[];
  routingRules: Record<string, unknown>[];
  cachingPolicy: Record<string, unknown>;
  rateLimits: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ProxyRoute {
  path: string;
  upstream: string;
  methods: string[];
  headers: Record<string, string>;
  timeout: number;
  retries: number;
}
export interface ProxyHealthStatus {
  upstream: string;
  healthy: boolean;
  latencyMs: number;
  lastCheck: string;
  errorRate: number;
}
