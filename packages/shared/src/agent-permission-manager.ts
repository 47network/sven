/** Batch 234 — Permission Manager types */

export type RoleAssignmentStatus = 'active' | 'suspended' | 'expired' | 'revoked';
export type PermissionCheckResult = 'granted' | 'denied' | 'delegated';

export interface AgentRole {
  id: string;
  agentId: string;
  roleName: string;
  description?: string;
  permissions: string[];
  parentRoleId?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRoleAssignment {
  id: string;
  targetAgentId: string;
  roleId: string;
  grantedBy: string;
  scope: Record<string, unknown>;
  expiresAt?: string;
  status: RoleAssignmentStatus;
  createdAt: string;
}

export interface AgentPermissionCheck {
  id: string;
  agentId: string;
  permission: string;
  resource?: string;
  result: PermissionCheckResult;
  evaluatedRoles: string[];
  checkedAt: string;
}
