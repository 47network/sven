/* Batch 191 — Proxy Router shared types */

export type ProxyUpstreamType = 'http' | 'https' | 'tcp' | 'udp' | 'grpc' | 'websocket';
export type ProxyUpstreamStatus = 'active' | 'draining' | 'unhealthy' | 'disabled' | 'maintenance';
export type ProxyRouteType = 'prefix' | 'exact' | 'regex' | 'host_header' | 'weighted' | 'canary';
export type ProxyCacheStatus = 'hit' | 'miss' | 'bypass' | 'expired' | 'stale' | 'revalidated';

export interface ProxyUpstream {
  id: string;
  agent_id: string;
  name: string;
  upstream_type: ProxyUpstreamType;
  status: ProxyUpstreamStatus;
  target_url: string;
  health_check_path?: string;
  health_check_interval_seconds: number;
  weight: number;
  max_connections: number;
  timeout_seconds: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProxyRoute {
  id: string;
  upstream_id: string;
  path_pattern: string;
  route_type: ProxyRouteType;
  priority: number;
  strip_prefix: boolean;
  rate_limit_rps?: number;
  cors_enabled: boolean;
  auth_required: boolean;
  headers_add: Record<string, string>;
  headers_remove: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProxyAccessLog {
  id: string;
  route_id: string;
  method: string;
  path: string;
  status_code: number;
  response_time_ms?: number;
  client_ip?: string;
  user_agent?: string;
  bytes_sent: number;
  upstream_response_time_ms?: number;
  cache_status?: ProxyCacheStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}
