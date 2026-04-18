/* Batch 60 — Agent Access Control & Permissions shared types */

export type RoleType = 'system' | 'custom' | 'inherited' | 'temporary' | 'delegated';

export type PermissionAction = 'read' | 'write' | 'execute' | 'delete' | 'admin';

export type PermissionEffect = 'allow' | 'deny';

export type PolicyType = 'rbac' | 'abac' | 'pbac' | 'mandatory' | 'discretionary';

export type AccessDecision = 'granted' | 'denied' | 'escalated' | 'revoked' | 'expired';

export type ScopeType = 'api' | 'data' | 'service' | 'resource' | 'delegation';

export type AccessControlAction =
  | 'role_assign'
  | 'role_revoke'
  | 'permission_grant'
  | 'permission_check'
  | 'policy_create'
  | 'audit_query'
  | 'scope_define';

export interface AgentRoleRow {
  id: string;
  agent_id: string;
  role_name: string;
  role_type: RoleType;
  permissions: unknown[];
  is_active: boolean;
  granted_by: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentPermissionRow {
  id: string;
  agent_id: string;
  resource: string;
  action: PermissionAction;
  effect: PermissionEffect;
  conditions: Record<string, unknown>;
  granted_by: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentAccessPolicyRow {
  id: string;
  policy_name: string;
  policy_type: PolicyType;
  priority: number;
  rules: unknown[];
  target_agents: unknown[];
  is_active: boolean;
  evaluated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentAccessAuditRow {
  id: string;
  agent_id: string;
  resource: string;
  action: string;
  decision: AccessDecision;
  policy_id: string | null;
  reason: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentScopeRow {
  id: string;
  agent_id: string;
  scope_name: string;
  scope_type: ScopeType;
  boundaries: Record<string, unknown>;
  is_active: boolean;
  granted_by: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const ROLE_TYPES: readonly RoleType[] = ['system', 'custom', 'inherited', 'temporary', 'delegated'] as const;
export const PERMISSION_ACTIONS: readonly PermissionAction[] = ['read', 'write', 'execute', 'delete', 'admin'] as const;
export const PERMISSION_EFFECTS: readonly PermissionEffect[] = ['allow', 'deny'] as const;
export const POLICY_TYPES: readonly PolicyType[] = ['rbac', 'abac', 'pbac', 'mandatory', 'discretionary'] as const;
export const ACCESS_DECISIONS: readonly AccessDecision[] = ['granted', 'denied', 'escalated', 'revoked', 'expired'] as const;
export const SCOPE_TYPES: readonly ScopeType[] = ['api', 'data', 'service', 'resource', 'delegation'] as const;

export function isRoleActive(role: AgentRoleRow): boolean {
  if (!role.is_active) return false;
  if (role.expires_at && new Date(role.expires_at) < new Date()) return false;
  return true;
}

export function isPermissionAllowed(effect: PermissionEffect): boolean {
  return effect === 'allow';
}

export function isAccessGranted(decision: AccessDecision): boolean {
  return decision === 'granted';
}

export function formatPermission(resource: string, action: PermissionAction): string {
  return `${resource}:${action}`;
}
