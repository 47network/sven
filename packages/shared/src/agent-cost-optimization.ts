/* Batch 130 — Agent Cost Optimization */

export type CostReportPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type CloudCostProvider = 'aws' | 'gcp' | 'azure' | 'hetzner' | 'self_hosted' | 'mixed';

export type CostRecommendationType = 'rightsize' | 'terminate' | 'reserve' | 'spot' | 'schedule' | 'consolidate';

export type BudgetAlertStatus = 'ok' | 'warning' | 'exceeded' | 'acknowledged';

export interface CostReport {
  id: string;
  agentId: string;
  reportPeriod: CostReportPeriod;
  provider: CloudCostProvider;
  totalCost: number;
  computeCost: number;
  storageCost: number;
  networkCost: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CostRecommendation {
  id: string;
  agentId: string;
  recommendation: CostRecommendationType;
  resourceType: string;
  resourceId: string;
  currentCost: number;
  projectedCost: number;
  savingsPct: number;
  confidence: number;
  applied: boolean;
  appliedAt?: string;
  createdAt: string;
}

export interface BudgetAlert {
  id: string;
  agentId: string;
  alertName: string;
  budgetLimit: number;
  thresholdPct: number;
  currentSpend: number;
  alertStatus: BudgetAlertStatus;
  notifiedAt?: string;
  createdAt: string;
}

export interface CostOptimizationStats {
  totalSpend: number;
  projectedSavings: number;
  recommendationCount: number;
  appliedCount: number;
  budgetUtilizationPct: number;
}
