export type WanCompressionAlgo = 'lz4' | 'zstd' | 'snappy' | 'gzip' | 'none';
export type WanTunnelProtocol = 'gre' | 'ipsec' | 'wireguard' | 'vxlan';
export type WanTunnelStatus = 'active' | 'degraded' | 'down' | 'maintenance';

export interface AgentWanConfig {
  id: string;
  agent_id: string;
  optimization_name: string;
  compression_algo: WanCompressionAlgo;
  dedup_enabled: boolean;
  tcp_optimization: boolean;
  bandwidth_limit_mbps: number | null;
  latency_target_ms: number;
  cache_size_mb: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentWanTunnel {
  id: string;
  config_id: string;
  tunnel_name: string;
  local_endpoint: string;
  remote_endpoint: string;
  protocol: WanTunnelProtocol;
  encryption: string;
  status: WanTunnelStatus;
  bytes_saved: number;
  created_at: string;
}

export interface AgentWanMetric {
  id: string;
  config_id: string;
  period_start: string;
  bytes_in: number;
  bytes_out: number;
  bytes_saved: number;
  compression_ratio: number;
  dedup_ratio: number;
  avg_latency_ms: number;
  created_at: string;
}
