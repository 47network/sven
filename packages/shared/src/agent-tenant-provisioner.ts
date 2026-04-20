export type IsolationLevel = 'namespace' | 'database' | 'container' | 'vm' | 'cluster';
export type ProvisioningStrategy = 'on_demand' | 'pre_provisioned' | 'pooled' | 'hybrid';
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioning' | 'terminated';
export type OperationType = 'provision' | 'deprovision' | 'scale' | 'migrate' | 'backup' | 'restore';

export interface TenantProvisionerConfig {
  id: string;
  agentId: string;
  isolationLevel: IsolationLevel;
  provisioningStrategy: ProvisioningStrategy;
  resourceQuotaCpu: number;
  resourceQuotaMemoryMb: number;
  maxTenants: number;
  autoCleanup: boolean;
  cleanupAfterDays: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  configId: string;
  agentId: string;
  tenantName: string;
  tenantSlug: string;
  status: TenantStatus;
  isolationLevel: IsolationLevel;
  resourceUsage: Record<string, unknown>;
  connectionString?: string;
  provisionedAt?: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TenantOperation {
  id: string;
  tenantId: string;
  operationType: OperationType;
  status: string;
  details: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}
