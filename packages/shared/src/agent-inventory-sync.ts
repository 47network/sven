// Batch 182: Agent Inventory Sync Types

export type InventoryAssetType = 'server' | 'container' | 'database' | 'storage' | 'network_device' | 'load_balancer' | 'dns_zone' | 'certificate' | 'application';
export type InventoryEnvironment = 'production' | 'staging' | 'development' | 'testing' | 'disaster_recovery';
export type InventoryAssetStatus = 'active' | 'inactive' | 'decommissioned' | 'maintenance' | 'unknown';
export type InventorySyncType = 'full' | 'incremental' | 'delta' | 'reconciliation';
export type InventorySyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';
export type InventoryChangeType = 'added' | 'updated' | 'removed' | 'configuration_changed' | 'status_changed' | 'tag_changed';

export interface InventoryAsset {
  id: string;
  assetType: InventoryAssetType;
  name: string;
  identifier: string;
  environment: InventoryEnvironment;
  provider: string | null;
  region: string | null;
  status: InventoryAssetStatus;
  configuration: Record<string, unknown>;
  tags: Record<string, string>;
  costPerMonth: number | null;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySyncJob {
  id: string;
  source: string;
  target: string;
  syncType: InventorySyncType;
  status: InventorySyncStatus;
  assetsScanned: number;
  assetsAdded: number;
  assetsUpdated: number;
  assetsRemoved: number;
  conflicts: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryChange {
  id: string;
  assetId: string;
  syncJobId: string | null;
  changeType: InventoryChangeType;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  applied: boolean;
  appliedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
