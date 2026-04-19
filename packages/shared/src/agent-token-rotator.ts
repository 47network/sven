export interface TokenRotatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  rotationIntervalHours: number;
  tokenType: string;
  autoRevokeOld: boolean;
  notificationChannels: string[];
  gracePeriodMinutes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface RotationEvent {
  tokenId: string;
  oldTokenHash: string;
  newTokenHash: string;
  rotatedAt: string;
  revokedOld: boolean;
  reason: string;
}
export interface TokenHealth {
  tokenId: string;
  ageHours: number;
  lastUsed: string;
  rotationDue: boolean;
  status: 'active' | 'expiring' | 'revoked';
}
