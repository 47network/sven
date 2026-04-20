/**
 * Batch 41 — Cross-Platform Revenue Dashboard
 * Unified analytics across all autonomous economy revenue streams.
 */

/* ------------------------------------------------------------------ */
/*  Enums / Type Unions                                                */
/* ------------------------------------------------------------------ */

export type RevenueStreamType =
  | 'marketplace'
  | 'publishing'
  | 'misiuni'
  | 'merch'
  | 'trading'
  | 'service_domain'
  | 'research'
  | 'integration'
  | 'collaboration'
  | 'subscription'
  | 'donation'
  | 'advertising';

export type StreamStatus =
  | 'active'
  | 'paused'
  | 'closed'
  | 'pending'
  | 'auditing';

export type SnapshotPeriod =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export type GoalType =
  | 'revenue_target'
  | 'profit_target'
  | 'tx_volume'
  | 'stream_launch'
  | 'expense_cap'
  | 'growth_rate';

export type GoalStatus =
  | 'active'
  | 'achieved'
  | 'missed'
  | 'cancelled'
  | 'paused';

export type AlertType =
  | 'revenue_drop'
  | 'expense_spike'
  | 'goal_at_risk'
  | 'stream_inactive'
  | 'anomaly_detected'
  | 'milestone_reached'
  | 'budget_exceeded';

export type AlertSeverity = 'info' | 'warning' | 'critical';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

export interface RevenueStream {
  id: string;
  streamType: RevenueStreamType;
  streamName: string;
  streamStatus: StreamStatus;
  ownerAgentId: string | null;
  currency: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  txCount: number;
  firstTxAt: string | null;
  lastTxAt: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueSnapshot {
  id: string;
  streamId: string;
  periodType: SnapshotPeriod;
  periodStart: string;
  periodEnd: string;
  revenue: number;
  expenses: number;
  net: number;
  txCount: number;
  topItems: unknown[];
  createdAt: string;
}

export interface RevenueGoal {
  id: string;
  goalName: string;
  goalType: GoalType;
  targetValue: number;
  currentValue: number;
  goalStatus: GoalStatus;
  deadline: string | null;
  streamId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  streamId: string | null;
  goalId: string | null;
  message: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const REVENUE_STREAM_TYPES: readonly RevenueStreamType[] = [
  'marketplace', 'publishing', 'misiuni', 'merch', 'trading',
  'service_domain', 'research', 'integration', 'collaboration',
  'subscription', 'donation', 'advertising',
] as const;

export const SNAPSHOT_PERIODS: readonly SnapshotPeriod[] = [
  'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
] as const;

export const GOAL_TYPES: readonly GoalType[] = [
  'revenue_target', 'profit_target', 'tx_volume',
  'stream_launch', 'expense_cap', 'growth_rate',
] as const;

export const ALERT_TYPES: readonly AlertType[] = [
  'revenue_drop', 'expense_spike', 'goal_at_risk', 'stream_inactive',
  'anomaly_detected', 'milestone_reached', 'budget_exceeded',
] as const;

export const GOAL_STATUS_ORDER: readonly GoalStatus[] = [
  'active', 'achieved', 'missed', 'cancelled', 'paused',
] as const;

export const STREAM_STATUS_ORDER: readonly StreamStatus[] = [
  'pending', 'active', 'paused', 'auditing', 'closed',
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function calculateProfitMargin(revenue: number, expenses: number): number {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - expenses) / revenue) * 10000) / 100;
}

export function isGoalOnTrack(goal: RevenueGoal): boolean {
  if (goal.goalStatus !== 'active' || !goal.deadline) return false;
  const now = Date.now();
  const created = new Date(goal.createdAt).getTime();
  const deadline = new Date(goal.deadline).getTime();
  const elapsed = (now - created) / (deadline - created);
  const progress = goal.currentValue / goal.targetValue;
  return progress >= elapsed * 0.8;
}

export function getAlertPriority(severity: AlertSeverity): number {
  switch (severity) {
    case 'critical': return 1;
    case 'warning': return 2;
    case 'info': return 3;
  }
}

export function formatCurrency(amount: number, currency: string = '47TOKEN'): string {
  if (currency === '47TOKEN') return `${amount.toFixed(2)} 47T`;
  return `${amount.toFixed(2)} ${currency}`;
}
