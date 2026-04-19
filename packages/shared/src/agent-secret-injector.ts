export interface SecretInjectorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  vaultProvider: string;
  injectionMethod: string;
  rotationEnabled: boolean;
  allowedNamespaces: string[];
  encryptionKeyId: string | null;
  auditLogging: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InjectedSecret {
  id: string;
  configId: string;
  secretName: string;
  targetNamespace: string;
  injectionMethod: string;
  version: number;
  expiresAt: string | null;
  injectedAt: string;
}

export interface SecretAuditEntry {
  id: string;
  secretId: string;
  action: string;
  performedBy: string;
  details: Record<string, unknown>;
  timestamp: string;
}
