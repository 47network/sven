export interface VolumeManagerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  storageClass: string;
  reclaimPolicy: string;
  maxSizeGb: number;
  snapshotEnabled: boolean;
  encryptionAtRest: boolean;
  backupSchedule: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ManagedVolume {
  id: string;
  configId: string;
  volumeName: string;
  sizeGb: number;
  usedGb: number;
  status: string;
  mountPath: string;
  createdAt: string;
}
export interface VolumeSnapshot {
  id: string;
  volumeId: string;
  snapshotName: string;
  sizeGb: number;
  status: string;
  createdAt: string;
}
