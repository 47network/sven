export type CorrelationStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export type PatternSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'certain';

export interface AgentEventCorrelatorConfig {
  id: string;
  agentId: string;
  name: string;
  correlationWindowSeconds: number;
  minConfidence: number;
  maxPatterns: number;
  autoLearn: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCorrelationPattern {
  id: string;
  configId: string;
  patternName: string;
  eventSequence: unknown[];
  confidence: number;
  occurrenceCount: number;
  lastMatchedAt?: Date;
  rootCause?: string;
  severity: PatternSeverity;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentCorrelationIncident {
  id: string;
  patternId: string;
  matchedEvents: unknown[];
  confidence: number;
  status: CorrelationStatus;
  resolvedAt?: Date;
  resolutionNotes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
