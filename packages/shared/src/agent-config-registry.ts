export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface ConfigRegistryConfig {
  id: string;
  agentId: string;
  defaultEnvironment: string;
  encryptionEnabled: boolean;
  versionRetention: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigEntry {
  id: string;
  configId: string;
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  environment: string;
  version: number;
  isCurrent: boolean;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedBy?: string;
}

export interface ConfigChangeLog {
  id: string;
  entryId: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy?: string;
  reason?: string;
  createdAt: Date;
}
