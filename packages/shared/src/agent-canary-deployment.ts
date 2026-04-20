// Batch 106 — Agent Canary Deployment

export type CanaryStatus = 'pending' | 'rolling' | 'paused' | 'promoted' | 'rolled_back' | 'failed';
export type CanaryTriggerType = 'error_rate' | 'latency_p99' | 'cpu_spike' | 'memory_spike' | 'custom';
export type CanaryVariant = 'baseline' | 'canary';

export interface CanaryRelease {
  id: string;
  agentId: string;
  serviceName: string;
  baselineVersion: string;
  canaryVersion: string;
  trafficPct: number;
  status: CanaryStatus;
  promotionCriteria: Record<string, unknown>;
  startedAt: string | null;
  promotedAt: string | null;
  rolledBackAt: string | null;
}

export interface CanaryMetric {
  id: string;
  releaseId: string;
  variant: CanaryVariant;
  metricName: string;
  metricValue: number;
  sampleCount: number;
  recordedAt: string;
}

export interface CanaryRollbackTrigger {
  id: string;
  releaseId: string;
  triggerType: CanaryTriggerType;
  threshold: number;
  currentValue: number | null;
  fired: boolean;
  firedAt: string | null;
}

export interface CanaryDeploymentStats {
  totalReleases: number;
  activeCanaries: number;
  promotedCount: number;
  rolledBackCount: number;
  avgPromotionTimeMs: number;
  rollbackTriggerRate: number;
}
