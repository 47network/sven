// Batch 98 — Agent Auto-Scaling shared types

export type ScalingResourceType = 'compute' | 'memory' | 'storage' | 'network' | 'gpu' | 'custom';

export type ScalingDirection = 'up' | 'down' | 'none';

export type ScalingMetricType = 'cpu_utilization' | 'memory_utilization' | 'request_rate' | 'queue_depth' | 'latency_p99' | 'error_rate' | 'custom';

export type ScalingEventStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface AutoScalingPolicy {
  id: string;
  agentId: string;
  resourceType: ScalingResourceType;
  minInstances: number;
  maxInstances: number;
  targetMetric: ScalingMetricType;
  targetValue: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoScalingEvent {
  id: string;
  policyId: string;
  direction: ScalingDirection;
  fromCount: number;
  toCount: number;
  triggerMetric: string;
  triggerValue: number;
  status: ScalingEventStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface AutoScalingMetricPoint {
  id: string;
  policyId: string;
  metricName: string;
  metricValue: number;
  instanceCount: number;
  recordedAt: string;
}

export interface AutoScalingStats {
  totalScaleUps: number;
  totalScaleDowns: number;
  currentInstances: number;
  avgUtilization: number;
  costSavings: number;
  lastScaleEvent: string | null;
}
