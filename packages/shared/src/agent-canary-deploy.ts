export type CanaryTarget = 'skill' | 'prompt' | 'config' | 'workflow' | 'handler';
export type CanaryStatus = 'pending' | 'running' | 'paused' | 'completed' | 'rolled_back' | 'failed';
export type CanaryDecision = 'promote' | 'rollback' | 'continue' | 'pause';
export type CanaryVariant = 'baseline' | 'canary';

export interface CanaryDeployConfig {
  id: string;
  agentId: string;
  name: string;
  target: CanaryTarget;
  baselineVersion: string;
  canaryVersion: string;
  trafficPct: number;
  status: CanaryStatus;
  successThreshold: number;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CanaryDeployMetrics {
  id: string;
  deployId: string;
  variant: CanaryVariant;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number | null;
  errorRate: number | null;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
}

export interface CanaryDeployDecision {
  id: string;
  deployId: string;
  decision: CanaryDecision;
  reason: string | null;
  trafficPctBefore: number | null;
  trafficPctAfter: number | null;
  decidedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CanaryDeployStats {
  totalDeploys: number;
  activeDeploys: number;
  promotedDeploys: number;
  rolledBackDeploys: number;
  avgSuccessRate: number;
  avgTrafficPct: number;
}
