export interface IncidentTrackerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  severityLevels: string[];
  escalationPolicy: Record<string, unknown>;
  autoAssign: boolean;
  slaTargets: Record<string, unknown>;
  notificationChannels: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentRecord {
  id: string;
  configId: string;
  title: string;
  severity: string;
  status: string;
  assignedTo: string | null;
  description: string;
  rootCause: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface EscalationEvent {
  id: string;
  incidentId: string;
  level: number;
  notifiedChannels: string[];
  message: string;
  triggeredAt: string;
}
