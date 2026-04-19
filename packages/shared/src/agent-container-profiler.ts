export interface ContainerProfilerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  profilingIntervalSeconds: number;
  metricsRetentionDays: number;
  cpuThresholdPercent: number;
  memoryThresholdPercent: number;
  autoScaleOnThreshold: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ContainerProfile {
  id: string;
  configId: string;
  containerId: string;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: Record<string, unknown>;
  diskIO: Record<string, unknown>;
  profiledAt: string;
}
export interface ProfileAlert {
  id: string;
  profileId: string;
  alertType: string;
  threshold: number;
  currentValue: number;
  acknowledged: boolean;
  triggeredAt: string;
}
