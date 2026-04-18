export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret' | 'list' | 'map';

export type ConfigAction = 'create' | 'update' | 'delete' | 'read' | 'rollback' | 'seal' | 'unseal';

export type ConfigMergeStrategy = 'override' | 'merge_deep' | 'merge_shallow' | 'skip_existing' | 'fail_on_conflict';

export type ConfigEnvironment = 'development' | 'staging' | 'production' | 'test';

export type ConfigPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ConfigNamespace {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  ownerAgentId?: string;
  isSealed: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigEntry {
  id: string;
  namespaceId: string;
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  version: number;
  isEncrypted: boolean;
  validationSchema?: Record<string, unknown>;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigVersion {
  id: string;
  entryId: string;
  version: number;
  oldValue?: unknown;
  newValue: unknown;
  changedBy?: string;
  changeReason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ConfigSchema {
  id: string;
  namespaceId: string;
  name: string;
  schema: Record<string, unknown>;
  isStrict: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigAuditEntry {
  id: string;
  entryId?: string;
  namespaceId: string;
  action: ConfigAction;
  actor?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isConfigSealed(ns: ConfigNamespace): boolean {
  return ns.isSealed;
}

export function configVersionCount(versions: ConfigVersion[]): number {
  return versions.length;
}

export function isSecretConfig(entry: ConfigEntry): boolean {
  return entry.valueType === 'secret' || entry.isEncrypted;
}
