// Batch 76: Agent Cost Optimization — shared types

export type CostBudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type CostResourceType = 'compute' | 'storage' | 'network' | 'llm_tokens' | 'api_call' | 'bandwidth' | 'memory';
export type CostRecommendationCategory = 'downsize' | 'eliminate' | 'schedule' | 'batch' | 'cache' | 'substitute';
export type CostAlertType = 'threshold' | 'spike' | 'anomaly' | 'forecast_overrun' | 'budget_exhausted';
export type CostAlertSeverity = 'info' | 'warning' | 'critical';

export interface CostBudget {
  id: string;
  budget_name: string;
  owner_agent_id?: string;
  period: CostBudgetPeriod;
  amount_tokens: number;
  spent_tokens: number;
  alert_threshold: number;
  status: string;
  metadata: Record<string, unknown>;
  starts_at: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CostEntry {
  id: string;
  budget_id?: string;
  agent_id: string;
  resource_type: CostResourceType;
  amount_tokens: number;
  description?: string;
  task_id?: string;
  metadata: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
}

export interface CostForecast {
  id: string;
  budget_id?: string;
  forecast_period: string;
  predicted_spend: number;
  confidence: number;
  model_used: string;
  factors: unknown[];
  created_at: string;
}

export interface CostRecommendation {
  id: string;
  budget_id?: string;
  category: CostRecommendationCategory;
  title: string;
  description?: string;
  estimated_savings: number;
  priority: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CostAlert {
  id: string;
  budget_id?: string;
  alert_type: CostAlertType;
  severity: CostAlertSeverity;
  message: string;
  acknowledged: boolean;
  metadata: Record<string, unknown>;
  triggered_at: string;
  acknowledged_at?: string;
  created_at: string;
}

export const BUDGET_PERIOD_DAYS: Record<CostBudgetPeriod, number> = {
  daily: 1, weekly: 7, monthly: 30, quarterly: 90, annual: 365,
};

export function budgetUtilization(spent: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((spent / total) * 10000) / 100;
}

export function isOverBudget(spent: number, total: number): boolean {
  return spent >= total;
}

export function dailyBurnRate(spent: number, daysPassed: number): number {
  if (daysPassed <= 0) return 0;
  return Math.round((spent / daysPassed) * 100) / 100;
}
