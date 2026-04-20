export interface NetworkFirewallComplianceCheckerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkFirewallComplianceCheckerEvent {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface NetworkFirewallComplianceCheckerRule {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
