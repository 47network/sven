export interface ResourceScalerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  scalingPolicy: string;
  minReplicas: number;
  maxReplicas: number;
  cpuThreshold: number;
  memoryThreshold: number;
  cooldownPeriod: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScalingEvent {
  id: string;
  configId: string;
  direction: 'up' | 'down';
  fromReplicas: number;
  toReplicas: number;
  triggerMetric: string;
  triggerValue: number;
  executedAt: string;
}

export interface ResourceSnapshot {
  id: string;
  configId: string;
  cpuUsage: number;
  memoryUsage: number;
  currentReplicas: number;
  pendingRequests: number;
  capturedAt: string;
}
