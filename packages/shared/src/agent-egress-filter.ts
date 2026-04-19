export interface EgressFilterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  allowedDestinations: string[];
  blockedDestinations: string[];
  protocolFilters: Record<string, unknown>;
  dataLossPrevention: Record<string, unknown>;
  loggingLevel: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface EgressRule {
  destination: string;
  protocol: string;
  action: 'allow' | 'block' | 'log';
  reason: string;
  appliedAt: string;
}
export interface EgressReport {
  totalRequests: number;
  blockedRequests: number;
  flaggedRequests: number;
  topDestinations: string[];
  reportPeriod: string;
}
