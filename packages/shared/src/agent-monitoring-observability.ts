/* Batch 58 — Agent Monitoring & Observability shared types */

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'rate';

export type AgentmAlertSeverity = 'info' | 'warning' | 'critical' | 'emergency' | 'resolved';

export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'silenced' | 'expired';

export type AgentmLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type SloTargetType = 'availability' | 'latency' | 'error_rate' | 'throughput' | 'saturation';

export type SloStatus = 'met' | 'at_risk' | 'breached' | 'unknown' | 'suspended';

export type MonitoringAction =
  | 'metric_record'
  | 'alert_create'
  | 'alert_acknowledge'
  | 'dashboard_create'
  | 'log_query'
  | 'slo_define'
  | 'slo_check';

export interface AgentMetricRow {
  id: string;
  agent_id: string;
  metric_name: string;
  metric_type: MetricType;
  value: number;
  unit?: string;
  labels: Record<string, string>;
  recorded_at: string;
}

export interface AgentAlertRow {
  id: string;
  agent_id: string;
  alert_name: string;
  severity: AgentmAlertSeverity;
  condition: string;
  threshold?: number;
  current_value?: number;
  message?: string;
  status: AlertStatus;
  fired_at: string;
  resolved_at?: string;
}

export interface AgentDashboardRow {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  layout: unknown[];
  panels: unknown[];
  refresh_interval_sec: number;
  is_public: boolean;
}

export interface AgentLogEntryRow {
  id: string;
  agent_id: string;
  level: AgentmLogLevel;
  message: string;
  context: Record<string, unknown>;
  source?: string;
  trace_id?: string;
  span_id?: string;
  recorded_at: string;
}

export interface AgentSloTargetRow {
  id: string;
  agent_id: string;
  slo_name: string;
  target_type: SloTargetType;
  target_value: number;
  current_value: number;
  window_hours: number;
  budget_remaining: number;
  status: SloStatus;
}

export const METRIC_TYPES: readonly MetricType[] = ['counter', 'gauge', 'histogram', 'summary', 'rate'] as const;
export const ALERT_SEVERITIES: readonly AgentmAlertSeverity[] = ['info', 'warning', 'critical', 'emergency', 'resolved'] as const;
export const ALERT_STATUSES: readonly AlertStatus[] = ['firing', 'acknowledged', 'resolved', 'silenced', 'expired'] as const;
export const LOG_LEVELS: readonly AgentmLogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export const SLO_TARGET_TYPES: readonly SloTargetType[] = ['availability', 'latency', 'error_rate', 'throughput', 'saturation'] as const;
export const SLO_STATUSES: readonly SloStatus[] = ['met', 'at_risk', 'breached', 'unknown', 'suspended'] as const;

export function isAlertActionable(status: AlertStatus): boolean {
  return status === 'firing' || status === 'acknowledged';
}

export function isSeverityCritical(severity: AgentmAlertSeverity): boolean {
  return severity === 'critical' || severity === 'emergency';
}

export function isSloHealthy(status: SloStatus): boolean {
  return status === 'met';
}

export function formatMetricLabel(name: string, value: number, unit?: string): string {
  return unit ? `${name}: ${value} ${unit}` : `${name}: ${value}`;
}
