export type ProxyType = 'reverse' | 'forward' | 'transparent' | 'socks5';
export type ProxyStatus = 'active' | 'inactive' | 'error' | 'maintenance';
export type ProxyRuleType = 'rewrite' | 'redirect' | 'block' | 'rate_limit' | 'header_inject';

export interface AgentProxyConfig {
  id: string;
  agentId: string;
  proxyType: ProxyType;
  upstreamUrl: string;
  listenPort: number;
  sslEnabled: boolean;
  cacheEnabled: boolean;
  rateLimit: number | null;
  healthCheckPath: string | null;
  status: ProxyStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProxyRule {
  id: string;
  configId: string;
  ruleType: ProxyRuleType;
  pathPattern: string | null;
  rewriteTarget: string | null;
  headers: Record<string, string>;
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface AgentProxyAccessLog {
  id: string;
  configId: string;
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  bytesSent: number;
  userAgent: string;
  createdAt: string;
}
