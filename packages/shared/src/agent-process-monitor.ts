export type ProcessType = 'service' | 'worker' | 'cron' | 'daemon' | 'batch' | 'stream';
export type ProcessStatus = 'running' | 'stopped' | 'crashed' | 'starting' | 'unknown' | 'degraded';
export type AlertType = 'warning' | 'critical' | 'info' | 'recovery' | 'anomaly';
export type MetricName = 'cpu_percent' | 'memory_mb' | 'disk_io' | 'network_io' | 'error_rate' | 'latency_ms';

export interface ProcessMonitorConfig {
  id: string;
  agentId: string;
  checkIntervalSeconds: number;
  alertThresholdPercent: number;
  retentionDays: number;
  autoRestart: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitoredProcess {
  id: string;
  configId: string;
  agentId: string;
  processName: string;
  processType: ProcessType;
  pid?: number;
  status: ProcessStatus;
  cpuPercent: number;
  memoryMb: number;
  uptimeSeconds: number;
  lastCheckAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ProcessAlert {
  id: string;
  processId: string;
  alertType: AlertType;
  alertMessage: string;
  metricName?: MetricName;
  metricValue?: number;
  thresholdValue?: number;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
