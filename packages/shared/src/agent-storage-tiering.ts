export type StorageTierLevel = 'hot' | 'warm' | 'cold' | 'archive';
export type StorageTierBackend = 'local' | 'ssd' | 'hdd' | 's3' | 'glacier';
export type StorageMigrationStatus = 'pending' | 'migrating' | 'completed' | 'failed' | 'cancelled';

export interface StorageTier {
  id: string;
  agentId: string;
  tierName: string;
  tierLevel: StorageTierLevel;
  storageBackend: StorageTierBackend;
  costPerGbMonth: number;
  maxCapacityGb: number | null;
  currentUsageGb: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLifecycleRule {
  id: string;
  agentId: string;
  ruleName: string;
  sourceTierId: string;
  targetTierId: string;
  ageThresholdDays: number;
  accessFrequencyThreshold: number | null;
  filePattern: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageTierMigration {
  id: string;
  ruleId: string | null;
  agentId: string;
  sourceTierId: string;
  targetTierId: string;
  objectsTotal: number;
  objectsMigrated: number;
  bytesMigrated: number;
  status: StorageMigrationStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface StorageTieringStats {
  totalTiers: number;
  totalRules: number;
  totalMigrations: number;
  bytesInHot: number;
  bytesInCold: number;
  monthlyCostEstimate: number;
}
