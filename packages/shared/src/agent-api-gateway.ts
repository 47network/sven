// Batch 73 — Agent API Gateway & Routing

export type AgentaHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type GatewayPolicyType = 'cors' | 'auth' | 'transform' | 'throttle' | 'circuit_breaker' | 'retry' | 'cache';
export type TransformDirection = 'request' | 'response';
export type LoadBalancerAlgorithm = 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash' | 'random';
export type ApiGatewayAction = 'route_create' | 'policy_attach' | 'transform_add' | 'pool_configure' | 'traffic_analyze' | 'route_test' | 'gateway_report';

export interface ApiRoute {
  id: string;
  agentId?: string;
  path: string;
  method: AgentaHttpMethod;
  targetUrl: string;
  enabled: boolean;
  authRequired: boolean;
  rateLimit: number;
  timeoutMs: number;
  priority: number;
}

export interface GatewayPolicy {
  id: string;
  name: string;
  policyType: GatewayPolicyType;
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  appliedRoutes: string[];
}

export interface RequestTransform {
  id: string;
  routeId: string;
  direction: TransformDirection;
  transformType: string;
  config: Record<string, unknown>;
  executionOrder: number;
  enabled: boolean;
}

export interface LoadBalancerPool {
  id: string;
  name: string;
  algorithm: LoadBalancerAlgorithm;
  healthCheck: Record<string, unknown>;
  targets: Array<{ url: string; weight: number; healthy: boolean }>;
  enabled: boolean;
}

export interface TrafficLog {
  id: string;
  routeId: string;
  method: string;
  path: string;
  statusCode?: number;
  latencyMs?: number;
  requestSize: number;
  responseSize: number;
}

export const HTTP_METHODS: AgentaHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export const GATEWAY_POLICY_TYPES: GatewayPolicyType[] = ['cors', 'auth', 'transform', 'throttle', 'circuit_breaker', 'retry', 'cache'];
export const LB_ALGORITHMS: LoadBalancerAlgorithm[] = ['round_robin', 'least_connections', 'weighted', 'ip_hash', 'random'];
export const TRANSFORM_DIRECTIONS: TransformDirection[] = ['request', 'response'];

export function matchRoute(path: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+').replace(/\*/g, '.*') + '$');
  return regex.test(path);
}
export function selectTarget(pool: LoadBalancerPool): string | null {
  const healthy = pool.targets.filter(t => t.healthy);
  return healthy.length > 0 ? healthy[0].url : null;
}
export function isSuccessStatus(code: number): boolean {
  return code >= 200 && code < 300;
}
export function calculateP99Latency(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.99) - 1;
  return sorted[Math.max(0, idx)] || 0;
}
