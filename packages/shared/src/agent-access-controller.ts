/* Batch 192 — Access Controller shared types */

export type AccessPolicyType = 'rbac' | 'abac' | 'acl' | 'mandatory' | 'discretionary' | 'rule_based';
export type AccessPolicyStatus = 'active' | 'disabled' | 'draft' | 'archived' | 'under_review';
export type AccessPolicyEffect = 'allow' | 'deny' | 'conditional';
export type AccessRoleType = 'admin' | 'operator' | 'viewer' | 'auditor' | 'service' | 'custom';
export type AccessRoleScope = 'global' | 'project' | 'team' | 'resource' | 'namespace';
export type AccessSubjectType = 'agent' | 'user' | 'service' | 'group' | 'api_key' | 'token';
export type AccessGrantType = 'permanent' | 'temporary' | 'scheduled' | 'conditional' | 'emergency';

export interface AccessPolicy {
  id: string;
  agent_id: string;
  name: string;
  policy_type: AccessPolicyType;
  status: AccessPolicyStatus;
  description?: string;
  priority: number;
  effect: AccessPolicyEffect;
  conditions: Record<string, unknown>;
  resources: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccessRole {
  id: string;
  policy_id: string;
  name: string;
  role_type: AccessRoleType;
  permissions: string[];
  scope: AccessRoleScope;
  inherits_from?: string;
  max_sessions?: number;
  session_timeout_minutes: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccessGrant {
  id: string;
  role_id: string;
  subject_id: string;
  subject_type: AccessSubjectType;
  granted_by?: string;
  grant_type: AccessGrantType;
  valid_from: string;
  valid_until?: string;
  revoked_at?: string;
  revocation_reason?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
