export type RoleType = 'system' | 'custom' | 'derived';

export interface RoleManagerConfig {
  id: string;
  agentId: string;
  hierarchyEnabled: boolean;
  maxRolesPerSubject: number;
  inheritanceDepth: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRole {
  id: string;
  configId: string;
  name: string;
  description?: string;
  parentRoleId?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

export interface RoleAssignment {
  id: string;
  configId: string;
  roleId: string;
  subject: string;
  assignedBy: string;
  expiresAt?: string;
  assignedAt: string;
}
