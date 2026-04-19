export type IncidentSeverity = 'critical' | 'high' | 'warning' | 'low';
export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'mitigating' | 'resolved' | 'closed';
export type IncidentSource = 'system' | 'agent' | 'manual' | 'alert';
export type EscalationAction = 'notify' | 'escalate' | 'assign' | 'acknowledge' | 'resolve' | 'comment';

export interface EscalationPolicy {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  severityThreshold: IncidentSeverity;
  autoEscalateAfterMins: number;
  maxEscalationLevel: number;
  notificationChannels: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIncident {
  id: string;
  policyId: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource;
  affectedServices: string[];
  currentEscalationLevel: number;
  assignedAgentId: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  rootCause: string | null;
  resolutionNotes: string | null;
}

export interface EscalationLog {
  id: string;
  incidentId: string;
  escalationLevel: number;
  action: EscalationAction;
  targetAgentId: string | null;
  channel: string;
  message: string | null;
  createdAt: string;
}

export interface IncidentEscalationStats {
  totalPolicies: number;
  openIncidents: number;
  mttrMinutes: number;
  escalatedCount24h: number;
  resolvedCount24h: number;
}
