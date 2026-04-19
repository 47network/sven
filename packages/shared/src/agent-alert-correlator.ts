export type CorrelationWindow = '1m' | '5m' | '15m' | '30m' | '1h';
export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'silenced';
export type CorrelationType = 'temporal' | 'causal' | 'topological' | 'semantic';

export interface AlertCorrelatorConfig {
  id: string;
  agentId: string;
  correlationWindow: CorrelationWindow;
  dedupInterval: string;
  severityThreshold: AlertSeverity;
  notificationChannels: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentAlert {
  id: string;
  configId: string;
  agentId: string;
  alertName: string;
  severity: AlertSeverity;
  source: string;
  message: string;
  fingerprint: string | null;
  status: AlertStatus;
  correlatedWith: string[];
  firedAt: Date;
  resolvedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AlertCorrelation {
  id: string;
  primaryAlertId: string;
  correlatedAlertId: string;
  correlationType: CorrelationType;
  confidence: number;
  createdAt: Date;
}
