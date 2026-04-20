// Batch 175: Agent Log Correlation types

export type LogPatternType = 'regex' | 'keyword' | 'structured' | 'ml_model' | 'anomaly_detection' | 'sequence';
export type LogSeverityThreshold = 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
export type LogIncidentType = 'cascade_failure' | 'error_storm' | 'latency_spike' | 'resource_exhaustion' | 'security_event' | 'data_anomaly';
export type LogIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LogIncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface LogCorrelationRule {
  id: string;
  agentId: string;
  ruleName: string;
  patternType: LogPatternType;
  patternConfig: Record<string, unknown>;
  severityThreshold: LogSeverityThreshold;
  correlationWindowMs: number;
  minOccurrences: number;
  enabled: boolean;
  lastTriggeredAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LogCorrelationIncident {
  id: string;
  ruleId: string | null;
  incidentType: LogIncidentType;
  severity: LogIncidentSeverity;
  title: string;
  summary: string;
  correlatedEntries: number;
  affectedServices: string[];
  rootCause: string | null;
  status: LogIncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface LogCorrelationEntry {
  id: string;
  incidentId: string;
  sourceService: string;
  logLevel: string;
  message: string;
  traceId: string | null;
  spanId: string | null;
  timestamp: string;
  extractedFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
