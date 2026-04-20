export type LBAlgorithm = 'round_robin' | 'weighted' | 'least_connections' | 'ip_hash' | 'random' | 'adaptive';

export type LBStatus = 'active' | 'draining' | 'standby' | 'failed' | 'maintenance';

export type BackendStatus = 'healthy' | 'unhealthy' | 'draining' | 'disabled';

export type MatchType = 'path' | 'header' | 'query' | 'method' | 'host' | 'cookie';

export type ProbeType = 'http' | 'tcp' | 'grpc' | 'custom';

export interface LBInstance {
  id: string;
  name: string;
  algorithm: LBAlgorithm;
  status: LBStatus;
  stickySessions: boolean;
  sessionTtlSeconds: number;
  maxConnections: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LBBackend {
  id: string;
  lbId: string;
  targetUrl: string;
  weight: number;
  status: BackendStatus;
  activeConnections: number;
  totalRequests: number;
  errorCount: number;
  avgResponseMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LBRoutingRule {
  id: string;
  lbId: string;
  name: string;
  matchType: MatchType;
  matchPattern: string;
  targetBackendId?: string;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LBHealthProbe {
  id: string;
  backendId: string;
  probeType: ProbeType;
  endpoint: string;
  intervalSeconds: number;
  timeoutMs: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastCheckAt?: string;
  lastStatus?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LBTrafficMetrics {
  id: string;
  lbId: string;
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  bytesIn: number;
  bytesOut: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isLBActive(lb: LBInstance): boolean {
  return lb.status === 'active';
}

export function backendErrorRate(b: LBBackend): number {
  return b.totalRequests > 0 ? b.errorCount / b.totalRequests : 0;
}

export function trafficSuccessRate(m: LBTrafficMetrics): number {
  return m.totalRequests > 0 ? m.successfulRequests / m.totalRequests : 1;
}
