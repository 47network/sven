// Batch 242: Endpoint Monitor types

export type EndpointCheckStatus = 'up' | 'down' | 'degraded' | 'timeout' | 'error';
export type EndpointAlertType = 'down' | 'degraded' | 'timeout' | 'ssl_expiry' | 'response_change' | 'recovered';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AgentMonitoredEndpoint {
  id: string;
  agentId: string;
  endpointUrl: string;
  endpointName: string;
  checkIntervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  expectedBodyContains: string | null;
  method: string;
  headers: Record<string, string>;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentEndpointCheck {
  id: string;
  endpointId: string;
  status: EndpointCheckStatus;
  responseTimeMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: string;
  metadata: Record<string, unknown>;
}

export interface AgentEndpointAlert {
  id: string;
  endpointId: string;
  alertType: EndpointAlertType;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
