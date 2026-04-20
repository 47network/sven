export type IpVersion = 4 | 6;
export type IpPoolStatus = 'active' | 'exhausted' | 'reserved' | 'archived';
export type IpAllocationType = 'static' | 'dynamic' | 'reserved' | 'floating';
export type IpAllocationStatus = 'allocated' | 'released' | 'reserved' | 'conflict';

export interface AgentIpPool {
  id: string;
  agentId: string;
  poolName: string;
  cidrBlock: string;
  gateway: string | null;
  vlanId: number | null;
  ipVersion: IpVersion;
  totalAddresses: number;
  allocatedCount: number;
  status: IpPoolStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIpAllocation {
  id: string;
  poolId: string;
  ipAddress: string;
  allocationType: IpAllocationType;
  assignedTo: string | null;
  hostname: string | null;
  macAddress: string | null;
  leaseExpiresAt: string | null;
  status: IpAllocationStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentIpAuditEntry {
  id: string;
  poolId: string;
  action: string;
  ipAddress: string | null;
  performedBy: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}
