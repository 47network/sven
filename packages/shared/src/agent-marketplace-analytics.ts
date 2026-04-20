// Batch 47 — Agent Marketplace Analytics shared types

export type AnalyticsPeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type RevenueEventType = 'task_payment' | 'listing_sale' | 'subscription_fee' | 'tip' | 'refund' | 'penalty' | 'bonus' | 'commission';

export type HealthIndicatorType = 'liquidity' | 'velocity' | 'concentration' | 'satisfaction' | 'fraud_risk' | 'growth' | 'churn' | 'retention';

export type HealthIndicatorStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export type AnalyticsDimension = 'time' | 'category' | 'agent' | 'skill' | 'geography' | 'price_range';

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'volatile';

export type ProductivityTier = 'elite' | 'high' | 'average' | 'below_average' | 'inactive';

export interface MarketplaceSnapshot {
  id: string;
  periodType: AnalyticsPeriodType;
  periodStart: string;
  periodEnd: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  totalRevenueTokens: number;
  avgCompletionTimeMs: number;
  uniqueSellers: number;
  uniqueBuyers: number;
  topCategories: Array<{ category: string; count: number; revenue: number }>;
  metadata: Record<string, unknown>;
}

export interface AgentProductivityMetric {
  id: string;
  agentId: string;
  periodType: AnalyticsPeriodType;
  periodStart: string;
  tasksCompleted: number;
  tasksFailed: number;
  tasksInProgress: number;
  avgQualityScore: number;
  totalEarningsTokens: number;
  avgResponseTimeMs: number;
  skillUtilization: Record<string, number>;
  efficiencyScore: number;
}

export interface RevenueTrendEvent {
  id: string;
  eventType: RevenueEventType;
  sourceId: string;
  sellerAgentId?: string;
  buyerAgentId?: string;
  amountTokens: number;
  category: string;
  tags: string[];
  recordedAt: string;
}

export interface CategoryPerformance {
  id: string;
  category: string;
  periodType: AnalyticsPeriodType;
  periodStart: string;
  taskCount: number;
  revenueTokens: number;
  avgRating: number;
  growthRate: number;
  topSellers: Array<{ agentId: string; revenue: number; tasks: number }>;
  demandScore: number;
}

export interface HealthIndicator {
  id: string;
  indicatorType: HealthIndicatorType;
  value: number;
  thresholdLow?: number;
  thresholdHigh?: number;
  status: HealthIndicatorStatus;
  details: Record<string, unknown>;
  measuredAt: string;
}

// --- Constants ---

export const ANALYTICS_PERIOD_TYPES: readonly AnalyticsPeriodType[] = ['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const REVENUE_EVENT_TYPES: readonly RevenueEventType[] = ['task_payment', 'listing_sale', 'subscription_fee', 'tip', 'refund', 'penalty', 'bonus', 'commission'] as const;

export const HEALTH_INDICATOR_TYPES: readonly HealthIndicatorType[] = ['liquidity', 'velocity', 'concentration', 'satisfaction', 'fraud_risk', 'growth', 'churn', 'retention'] as const;

export const HEALTH_STATUS_VALUES: readonly HealthIndicatorStatus[] = ['healthy', 'warning', 'critical', 'unknown'] as const;

export const PRODUCTIVITY_TIERS: readonly ProductivityTier[] = ['elite', 'high', 'average', 'below_average', 'inactive'] as const;

export const TREND_DIRECTIONS: readonly TrendDirection[] = ['rising', 'falling', 'stable', 'volatile'] as const;

// --- Helpers ---

export function getProductivityTier(efficiencyScore: number): ProductivityTier {
  if (efficiencyScore >= 90) return 'elite';
  if (efficiencyScore >= 70) return 'high';
  if (efficiencyScore >= 40) return 'average';
  if (efficiencyScore >= 10) return 'below_average';
  return 'inactive';
}

export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function getTrendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'stable';
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, d) => a + (d - avgDiff) ** 2, 0) / diffs.length;
  if (Math.sqrt(variance) > Math.abs(avgDiff) * 2) return 'volatile';
  if (avgDiff > 0.01) return 'rising';
  if (avgDiff < -0.01) return 'falling';
  return 'stable';
}

export function evaluateHealthStatus(value: number, thresholdLow?: number, thresholdHigh?: number): HealthIndicatorStatus {
  if (thresholdLow === undefined || thresholdHigh === undefined) return 'unknown';
  if (value >= thresholdLow && value <= thresholdHigh) return 'healthy';
  const lowDist = thresholdLow !== undefined ? Math.abs(value - thresholdLow) : Infinity;
  const highDist = thresholdHigh !== undefined ? Math.abs(value - thresholdHigh) : Infinity;
  const margin = (thresholdHigh - thresholdLow) * 0.2;
  if (lowDist <= margin || highDist <= margin) return 'warning';
  return 'critical';
}
