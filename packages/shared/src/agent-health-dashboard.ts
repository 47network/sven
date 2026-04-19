export interface HealthDashboardConfig {
  id: string;
  agentId: string;
  dashboardName: string;
  refreshSeconds: number;
  widgets: DashboardWidget[];
  alertRules: AlertRule[];
  retentionDays: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface DashboardWidget {
  id: string;
  type: 'gauge' | 'chart' | 'table' | 'status' | 'counter';
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
}
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
}
