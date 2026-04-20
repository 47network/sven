export type IncidentType = 'security_breach' | 'data_leak' | 'service_outage' | 'unauthorized_access' | 'malware' | 'ddos' | 'configuration_drift';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
export type ResponseActionType = 'investigate' | 'contain' | 'eradicate' | 'recover' | 'communicate' | 'escalate';

export interface AgentIncident {
  id: string;
  agentId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  status: IncidentStatus;
  assignedTo?: string;
  impactScope: Record<string, unknown>;
  timeline: Record<string, unknown>[];
  createdAt: Date;
  resolvedAt?: Date;
}

export interface AgentIncidentResponse {
  id: string;
  incidentId: string;
  responderId: string;
  actionType: ResponseActionType;
  actionDetail: string;
  outcome?: string;
  performedAt: Date;
}

export interface AgentPostmortem {
  id: string;
  incidentId: string;
  rootCause: string;
  contributingFactors: string[];
  lessonsLearned: string[];
  actionItems: Record<string, unknown>[];
  timelineSummary?: string;
  createdAt: Date;
}
