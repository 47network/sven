export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface IncidentCommanderConfig {
  id: string;
  agentId: string;
  severityLevels: IncidentSeverity[];
  escalationPolicy: Record<string, unknown>;
  onCallSchedule: Record<string, unknown>;
  autoAssign: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  configId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedAgentId?: string;
  rootCause?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface IncidentTimeline {
  id: string;
  incidentId: string;
  eventType: string;
  description: string;
  actorAgentId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
