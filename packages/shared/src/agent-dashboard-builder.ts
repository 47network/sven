export type DashboardTheme = 'dark' | 'light' | 'system' | 'cyberpunk';
export type PanelType = 'line_chart' | 'bar_chart' | 'gauge' | 'table' | 'stat' | 'heatmap' | 'logs' | 'text';
export type LayoutType = 'grid' | 'freeform' | 'rows' | 'columns';

export interface AgentDashboardBuilderConfig {
  id: string;
  agentId: string;
  name: string;
  theme: DashboardTheme;
  autoRefreshSeconds: number;
  defaultTimeRange: string;
  layoutType: LayoutType;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDashboardPanel {
  id: string;
  configId: string;
  title: string;
  panelType: PanelType;
  dataSource: string;
  query: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  options: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDashboardSnapshot {
  id: string;
  configId: string;
  snapshotName: string;
  panelData: unknown;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  sharedUrl?: string;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
