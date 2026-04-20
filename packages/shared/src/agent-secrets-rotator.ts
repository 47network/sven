export interface SecretsRotatorConfig {
  id: string;
  agentId: string;
  secretName: string;
  rotationDays: number;
  lastRotatedAt: string | null;
  vaultBackend: string;
  notifyOnRotation: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RotationResult {
  secretName: string;
  rotatedAt: string;
  nextRotation: string;
  vaultBackend: string;
  notified: boolean;
}
export interface RotationSchedule {
  secretName: string;
  lastRotated: string | null;
  nextDue: string;
  overdue: boolean;
  daysUntilDue: number;
}
