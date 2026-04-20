export interface SlaReporterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  slaDefinitions: Record<string, unknown>[];
  reportingInterval: string;
  breachThreshold: number;
  autoEscalate: boolean;
  recipients: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SlaReport {
  id: string;
  configId: string;
  period: string;
  complianceRate: number;
  totalObjectives: number;
  breachedObjectives: number;
  details: Record<string, unknown>[];
  generatedAt: string;
}

export interface SlaBreach {
  id: string;
  reportId: string;
  objectiveName: string;
  targetValue: number;
  actualValue: number;
  severity: string;
  notifiedAt: string | null;
}
