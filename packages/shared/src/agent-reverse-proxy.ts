export type ProxyStatus = 'active' | 'inactive' | 'maintenance' | 'failed';
export type ProxyProtocol = 'http' | 'https' | 'http2' | 'grpc' | 'websocket';
export type ProxyLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentProxyConfig {
  id: string;
  agent_id: string;
  proxy_name: string;
  listen_port: number;
  ssl_enabled: boolean;
  compression_enabled: boolean;
  request_buffering: boolean;
  status: ProxyStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentProxyUpstream {
  id: string;
  config_id: string;
  upstream_name: string;
  upstream_url: string;
  path_prefix: string;
  rewrite_path: boolean;
  headers_add: Record<string, string>;
  priority: number;
  created_at: string;
}

export interface AgentProxyAccessLog {
  id: string;
  config_id: string;
  client_ip: string | null;
  method: string | null;
  request_path: string | null;
  upstream_name: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  bytes_sent: number | null;
  logged_at: string;
}
