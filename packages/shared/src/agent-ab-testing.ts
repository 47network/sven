// Batch 102 — Agent A/B Testing shared types

export type AbExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

export type AbMetricType = 'conversion_rate' | 'revenue' | 'engagement' | 'retention' | 'latency' | 'error_rate' | 'custom';

export interface AbExperiment {
  id: string;
  agentId: string;
  experimentName: string;
  description: string | null;
  targetMetric: string;
  trafficSplit: Record<string, number>;
  minSampleSize: number;
  confidenceLevel: number;
  status: AbExperimentStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AbVariant {
  id: string;
  experimentId: string;
  variantName: string;
  variantConfig: Record<string, unknown>;
  impressions: number;
  conversions: number;
  revenue: number;
  customMetrics: Record<string, unknown>;
  createdAt: string;
}

export interface AbAssignment {
  id: string;
  experimentId: string;
  variantId: string;
  userHash: string;
  assignedAt: string;
}

export interface AbTestResult {
  id: string;
  experimentId: string;
  winningVariantId: string | null;
  statisticalSignificance: number | null;
  pValue: number | null;
  liftPercentage: number | null;
  confidenceInterval: Record<string, unknown> | null;
  recommendation: string | null;
  calculatedAt: string;
}

export interface AbTestStats {
  totalExperiments: number;
  activeExperiments: number;
  completedExperiments: number;
  avgLiftPercentage: number;
  avgConfidence: number;
  totalImpressions: number;
}
