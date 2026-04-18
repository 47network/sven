// Batch 77: Agent Multi-Tenancy — shared types

export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type TenantMemberRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
export type TenantQuotaResource = 'agents' | 'tasks' | 'storage_mb' | 'api_calls' | 'llm_tokens' | 'bandwidth_mb';
export type TenantInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Tenant {
  id: string;
  tenant_name: string;
  slug: string;
  owner_id: string;
  plan: TenantPlan;
  status: TenantStatus;
  max_agents: number;
  max_storage_mb: number;
  metadata: Record<string, unknown>;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantMemberRole;
  permissions: string[];
  invited_by?: string;
  status: string;
  metadata: Record<string, unknown>;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface TenantQuota {
  id: string;
  tenant_id: string;
  resource_type: TenantQuotaResource;
  quota_limit: number;
  current_usage: number;
  reset_period: string;
  last_reset_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantMemberRole;
  token: string;
  status: TenantInvitationStatus;
  invited_by: string;
  expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TenantAuditEntry {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  resource?: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export const PLAN_AGENT_LIMITS: Record<TenantPlan, number> = {
  free: 5, starter: 20, pro: 100, enterprise: 500, custom: 9999,
};

export function isQuotaExceeded(usage: number, limit: number): boolean {
  return usage >= limit;
}

export function quotaUtilization(usage: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.round((usage / limit) * 10000) / 100;
}

export function hasPermission(member: TenantMember, permission: string): boolean {
  if (member.role === 'owner' || member.role === 'admin') return true;
  return member.permissions.includes(permission);
}
