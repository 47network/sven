export interface DataPartitionerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  partitionStrategy: string;
  partitionKey: string;
  partitionCount: number;
  retentionPolicy: Record<string, unknown>;
  rebalanceSchedule: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface PartitionInfo {
  partitionName: string;
  rowCount: number;
  sizeBytes: number;
  minValue: string;
  maxValue: string;
  lastAccessed: string;
}
export interface PartitionPlan {
  tableName: string;
  strategy: string;
  partitions: number;
  estimatedSizeReduction: number;
  migrationSteps: string[];
}
