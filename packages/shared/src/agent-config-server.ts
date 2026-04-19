export interface ConfigNamespace {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  environment: ConfigEnvironment;
  encryptionEnabled: boolean;
  version: number;
  status: ConfigNamespaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigEntry {
  id: string;
  namespaceId: string;
  key: string;
  value: string;
  valueType: ConfigValueType;
  isSecret: boolean;
  description: string | null;
  validationRegex: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigChangeLog {
  id: string;
  entryId: string;
  previousValue: string | null;
  newValue: string | null;
  changedBy: string;
  changeReason: string | null;
  rollbackOf: string | null;
  createdAt: string;
}

export type ConfigEnvironment = 'development' | 'staging' | 'production' | 'canary' | 'test';
export type ConfigNamespaceStatus = 'active' | 'locked' | 'archived' | 'migrating';
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret' | 'url' | 'duration' | 'bytes';
