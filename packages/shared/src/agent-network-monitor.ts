// Batch 213: Network Monitor — agent-managed network monitoring and alerting

export type NetworkMonitorTargetType = 'host' | 'service' | 'port' | 'endpoint' | 'network' | 'container';
export type NetworkMonitorProtocol = 'icmp' | 'tcp' | 'udp' | 'http' | 'https' | 'grpc' | 'dns' | 'snmp';
export type NetworkMonitorStatus = 'active' | 'paused' | 'disabled' | 'alerting' | 'maintenance';
export type NetworkCheckResult = 'up' | 'down' | 'degraded' | 'timeout' | 'unknown';
export type NetworkAlertType = 'down' | 'degraded' | 'latency_high' | 'packet_loss' | 'threshold_breach' | 'recovery' | 'flapping';
export type NetworkAlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type NetworkMetricType = 'latency' | 'packet_loss' | 'throughput' | 'jitter' | 'availability' | 'error_rate' | 'connection_count';

export interface AgentNetworkMonitor {
  id: string;
  agentId: string;
  monitorName: string;
  targetType: NetworkMonitorTargetType;
  targetAddress: string;
  protocol: NetworkMonitorProtocol;
  checkIntervalSeconds: number;
  timeoutSeconds: number;
  status: NetworkMonitorStatus;
  lastCheckAt: string | null;
  lastStatus: NetworkCheckResult | null;
  uptimePercent: number | null;
  consecutiveFailures: number;
  alertThreshold: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentNetworkAlert {
  id: string;
  monitorId: string;
  agentId: string;
  alertType: NetworkAlertType;
  severity: NetworkAlertSeverity;
  message: string;
  responseTimeMs: number | null;
  packetLossPercent: number | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentNetworkMetric {
  id: string;
  monitorId: string;
  metricType: NetworkMetricType;
  value: number;
  unit: string;
  recordedAt: string;
  metadata: Record<string, unknown>;
}
