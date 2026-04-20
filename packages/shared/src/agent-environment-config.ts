// Batch 70 — Agent Environment Configuration

export type EnvironmentType = 'development' | 'staging' | 'production' | 'testing';
export type VariableSource = 'manual' | 'vault' | 'env_file' | 'inherited' | 'computed';
export type ConfigAuditAction = 'created' | 'updated' | 'deleted' | 'rotated' | 'exported' | 'imported';
export type ConfigTemplateFieldType = 'string' | 'number' | 'boolean' | 'json' | 'secret';
export type EnvironmentConfigAction = 'profile_create' | 'variable_set' | 'variable_delete' | 'template_apply' | 'snapshot_create' | 'config_export' | 'config_report';

export interface EnvProfile {
  id: string;
  agentId?: string;
  name: string;
  environment: EnvironmentType;
  description?: string;
  isDefault: boolean;
  metadata: Record<string, unknown>;
}

export interface EnvVariable {
  id: string;
  profileId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  source: VariableSource;
  overrideOf?: string;
  description?: string;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  variables: Array<{ key: string; type: ConfigTemplateFieldType; required: boolean }>;
  defaults: Record<string, unknown>;
  requiredKeys: string[];
}

export interface ConfigSnapshot {
  id: string;
  profileId: string;
  snapshotData: Record<string, unknown>;
  reason?: string;
  createdBy?: string;
}

export interface ConfigAuditEntry {
  id: string;
  profileId: string;
  action: ConfigAuditAction;
  variableKey?: string;
  performedBy?: string;
}

export const ENVIRONMENT_TYPES: EnvironmentType[] = ['development', 'staging', 'production', 'testing'];
export const VARIABLE_SOURCES: VariableSource[] = ['manual', 'vault', 'env_file', 'inherited', 'computed'];
export const CONFIG_AUDIT_ACTIONS: ConfigAuditAction[] = ['created', 'updated', 'deleted', 'rotated', 'exported', 'imported'];
export const CONFIG_FIELD_TYPES: ConfigTemplateFieldType[] = ['string', 'number', 'boolean', 'json', 'secret'];

export function isSecretVariable(source: VariableSource): boolean {
  return source === 'vault';
}
export function maskSecretValue(value: string): string {
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}
export function validateRequiredKeys(variables: Record<string, unknown>, required: string[]): string[] {
  return required.filter(k => !(k in variables));
}
export function mergeProfiles(base: Record<string, string>, override: Record<string, string>): Record<string, string> {
  return { ...base, ...override };
}
