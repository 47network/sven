// Batch 78 — Agent Incident Management shared types

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'mitigating' | 'resolved' | 'closed' | 'postmortem';
export type IncidentSource = 'agent' | 'monitor' | 'user' | 'system' | 'external';
export type IncidentImpactScope = 'single' | 'service' | 'cluster' | 'platform' | 'global';
export type IncidentTimelineEventType = 'created' | 'acknowledged' | 'escalated' | 'assigned' | 'status_change' | 'comment' | 'action_taken' | 'resolved' | 'reopened' | 'closed';

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource;
  affectedService?: string;
  affectedAgentId?: string;
  assignedAgentId?: string;
  reporterId?: string;
  priority: number;
  impactScope: IncidentImpactScope;
  rootCause?: string;
  resolution?: string;
  startedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentTimelineEntry {
  id: string;
  incidentId: string;
  eventType: IncidentTimelineEventType;
  actorId?: string;
  actorType: 'agent' | 'user' | 'system' | 'automation';
  description?: string;
  previousValue?: string;
  newValue?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentEscalation {
  id: string;
  incidentId: string;
  fromLevel: number;
  toLevel: number;
  reason?: string;
  escalatedBy?: string;
  escalatedTo?: string;
  autoEscalation: boolean;
  acknowledged: boolean;
  acknowledgedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentRunbook {
  id: string;
  title: string;
  description?: string;
  triggerConditions: Record<string, unknown>;
  severityFilter: IncidentSeverity[];
  serviceFilter: string[];
  steps: Array<{ order: number; action: string; description: string; automated: boolean }>;
  autoExecute: boolean;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: string;
  createdBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentPostmortem {
  id: string;
  incidentId: string;
  summary: string;
  timelineSummary?: string;
  rootCauseAnalysis?: string;
  contributingFactors: string[];
  actionItems: Array<{ title: string; assignee?: string; dueDate?: string; status: string }>;
  lessonsLearned?: string;
  preventionMeasures: string[];
  metrics: Record<string, unknown>;
  authorId?: string;
  reviewedBy: string[];
  status: 'draft' | 'review' | 'approved' | 'published';
  publishedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const IncidentSEVERITY_PRIORITY: Record<IncidentSeverity, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

export const AUTO_ESCALATION_THRESHOLDS: Record<IncidentSeverity, number> = {
  critical: 15, high: 30, medium: 60, low: 240, info: 0,
};

export function shouldAutoEscalate(severity: IncidentSeverity, minutesSinceCreated: number): boolean {
  const threshold = AUTO_ESCALATION_THRESHOLDS[severity];
  return threshold > 0 && minutesSinceCreated >= threshold;
}

export function meanTimeToResolve(incidents: Pick<Incident, 'startedAt' | 'resolvedAt'>[]): number {
  const resolved = incidents.filter(i => i.resolvedAt);
  if (resolved.length === 0) return 0;
  const total = resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt!).getTime() - new Date(i.startedAt).getTime()), 0);
  return total / resolved.length;
}
