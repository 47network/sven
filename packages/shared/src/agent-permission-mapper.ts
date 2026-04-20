export interface PermissionMapperConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  permissionModel: string;
  roleHierarchy: Record<string, unknown>;
  defaultPermissions: string[];
  inheritanceEnabled: boolean;
  auditChanges: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface RoleMapping {
  roleId: string;
  roleName: string;
  permissions: string[];
  parentRole: string | null;
  memberCount: number;
}
export interface PermissionCheck {
  subject: string;
  resource: string;
  action: string;
  allowed: boolean;
  reason: string;
}
