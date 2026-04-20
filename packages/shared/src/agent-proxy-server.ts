// Batch 217: Proxy Server — proxy routing, caching, and access control

export type ProxyType = 'forward' | 'reverse' | 'transparent' | 'socks5' | 'http_connect' | 'api_gateway' | 'cdn';
export type ProxyAuthMethod = 'basic' | 'bearer' | 'api_key' | 'mtls' | 'oauth2' | 'none';
export type ProxyEndpointStatus = 'active' | 'inactive' | 'draining' | 'error' | 'maintenance';
export type ProxyAccessRuleType = 'allow' | 'deny' | 'rate_limit' | 'rewrite' | 'header_inject' | 'cors' | 'cache_override' | 'redirect';
export type ProxyMatchType = 'path' | 'header' | 'query' | 'method' | 'ip' | 'user_agent' | 'cookie' | 'body';

export interface AgentProxyEndpoint {
  id: string;
  agentId: string;
  endpointName: string;
  proxyType: ProxyType;
  listenAddress: string;
  listenPort: number;
  upstreamUrl: string;
  tlsEnabled: boolean;
  authRequired: boolean;
  authMethod: ProxyAuthMethod | null;
  status: ProxyEndpointStatus;
  maxConnections: number;
  timeoutSeconds: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProxyAccessRule {
  id: string;
  endpointId: string;
  agentId: string;
  ruleName: string;
  ruleType: ProxyAccessRuleType;
  matchType: ProxyMatchType;
  matchPattern: string;
  actionConfig: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  hitCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProxyTrafficLog {
  id: string;
  endpointId: string;
  method: string;
  requestPath: string;
  statusCode: number;
  requestSizeBytes: number | null;
  responseSizeBytes: number | null;
  responseTimeMs: number | null;
  clientIp: string | null;
  upstreamStatus: number | null;
  cacheHit: boolean;
  ruleMatched: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  loggedAt: string;
}
