export type EnforcementMode = 'enforce' | 'permissive' | 'audit_only';
export type DefaultPolicy = 'allow' | 'deny';
export type SubjectType = 'agent' | 'user' | 'service' | 'group';

export interface AgentRbacEnforcerConfig {
  id: string;
  agentId: string;
  name: string;
  enforcementMode: EnforcementMode;
  defaultPolicy: DefaultPolicy;
  auditEnabled: boolean;
  cacheTtlSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRbacRole {
  id: string;
  configId: string;
  roleName: string;
  description?: string;
  permissions: string[];
  parentRoleId?: string;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentRbacAssignment {
  id: string;
  configId: string;
  roleId: string;
  subjectId: string;
  subjectType: SubjectType;
  scope?: string;
  expiresAt?: Date;
  grantedBy?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
