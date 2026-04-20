export interface ReferralCodeIssuerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralCode {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface IssuerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
