export type VaultEngine = 'kv' | 'transit' | 'pki' | 'database' | 'ssh';
export type VaultAction = 'read' | 'write' | 'delete' | 'rotate' | 'seal' | 'unseal' | 'list';

export interface SecretVault {
  id: string;
  agentId: string;
  name: string;
  engine: VaultEngine;
  maxVersions: number;
  casRequired: boolean;
  sealed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecret {
  id: string;
  vaultId: string;
  path: string;
  version: number;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface VaultAccessLog {
  id: string;
  vaultId: string;
  secretId: string | null;
  action: VaultAction;
  accessor: string;
  ipAddress: string | null;
  success: boolean;
  createdAt: string;
}

export interface SecretsVaultStats {
  totalVaults: number;
  totalSecrets: number;
  sealedVaults: number;
  expiringSecrets: number;
  accessCount24h: number;
}
