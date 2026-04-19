export type SiemType = 'opensearch' | 'elasticsearch' | 'splunk' | 'sentinel' | 'qradar';
export type EventCategory = 'authentication' | 'network' | 'file' | 'process' | 'threat' | 'compliance';
export type DashboardType = 'threat_overview' | 'compliance' | 'network_flow' | 'user_behavior' | 'custom';

export interface AgentSiemConnectorConfig {
  id: string;
  agentId: string;
  name: string;
  siemType: SiemType;
  connectionUrl?: string;
  ingestionRateLimit: number;
  normalizationEnabled: boolean;
  enrichmentEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSiemEvent {
  id: string;
  configId: string;
  eventSource: string;
  eventCategory: EventCategory;
  severity: string;
  rawEvent: Record<string, unknown>;
  normalizedEvent: Record<string, unknown>;
  enrichments: Record<string, unknown>;
  correlationId?: string;
  ingestedAt: Date;
  createdAt: Date;
}

export interface AgentSiemDashboard {
  id: string;
  configId: string;
  dashboardName: string;
  dashboardType: DashboardType;
  queryDefinitions: unknown[];
  refreshIntervalSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
