export type DefaultPolicy = 'allow' | 'deny';
export type AccessEffect = 'allow' | 'deny';
export type AccessDecision = 'allowed' | 'denied' | 'challenged';

export interface AccessControlManagerConfig {
  id: string;
  agentId: string;
  defaultPolicy: DefaultPolicy;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  ipWhitelist: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessPolicy {
  id: string;
  configId: string;
  name: string;
  resourcePattern: string;
  actions: string[];
  effect: AccessEffect;
  conditions: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
}

export interface AccessLog {
  id: string;
  configId: string;
  principalId: string;
  resource: string;
  action: string;
  decision: AccessDecision;
  policyId?: string;
  ipAddress?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
