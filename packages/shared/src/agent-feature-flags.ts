/* Batch 65 — Agent Feature Flags & Experiments */

export type FlagType = 'boolean' | 'percentage' | 'variant' | 'schedule' | 'allowlist';
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type FeatureFlagAction = 'flag_create' | 'flag_toggle' | 'experiment_create' | 'experiment_start' | 'variant_assign' | 'metric_record' | 'experiment_conclude';

export const FLAG_TYPES: FlagType[] = ['boolean', 'percentage', 'variant', 'schedule', 'allowlist'];
export const EXPERIMENT_STATUSES: ExperimentStatus[] = ['draft', 'running', 'paused', 'completed', 'cancelled'];
export const FEATURE_FLAG_ACTIONS: FeatureFlagAction[] = ['flag_create', 'flag_toggle', 'experiment_create', 'experiment_start', 'variant_assign', 'metric_record', 'experiment_conclude'];

export interface AgentFeatureFlag {
  id: string;
  flagKey: string;
  flagName: string;
  description?: string;
  flagType: FlagType;
  defaultValue: unknown;
  currentValue: unknown;
  isEnabled: boolean;
  owner?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentExperiment {
  id: string;
  experimentKey: string;
  experimentName: string;
  description?: string;
  hypothesis?: string;
  status: ExperimentStatus;
  startDate?: string;
  endDate?: string;
  trafficPct: number;
  winnerVariant?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  variantKey: string;
  variantName: string;
  weight: number;
  config: Record<string, unknown>;
  isControl: boolean;
  createdAt: string;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  agentId: string;
  variantId: string;
  assignedAt: string;
}

export interface ExperimentMetric {
  id: string;
  experimentId: string;
  variantId: string;
  metricName: string;
  metricValue: number;
  sampleSize: number;
  recordedAt: string;
}

export function isFlagEnabled(flag: AgentFeatureFlag): boolean {
  return flag.isEnabled && flag.currentValue !== false;
}

export function isExperimentActive(exp: AgentExperiment): boolean {
  return exp.status === 'running';
}

export function calculateVariantWinner(metrics: ExperimentMetric[]): string | null {
  if (metrics.length === 0) return null;
  const best = metrics.reduce((a, b) => a.metricValue > b.metricValue ? a : b);
  return best.variantId;
}

export function getTrafficAllocation(trafficPct: number, weight: number): number {
  return Math.round((trafficPct / 100) * (weight / 100) * 10000) / 100;
}
